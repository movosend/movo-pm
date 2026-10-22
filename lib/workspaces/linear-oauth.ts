import "server-only"

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"
import { eq } from "drizzle-orm"

const TOKEN_URL = "https://api.linear.app/oauth/token"

function encryptionKey() {
  const value = process.env.LINEAR_TOKEN_ENCRYPTION_KEY
  const key = value ? Buffer.from(value, "base64") : Buffer.alloc(0)
  if (key.length !== 32)
    throw new Error(
      "Configurá LINEAR_TOKEN_ENCRYPTION_KEY con 32 bytes en base64."
    )
  return key
}

export function encryptToken(token: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv)
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ])
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64")
}

export function decryptToken(value: string): string {
  const buffer = Buffer.from(value, "base64")
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    buffer.subarray(0, 12)
  )
  decipher.setAuthTag(buffer.subarray(12, 28))
  return Buffer.concat([
    decipher.update(buffer.subarray(28)),
    decipher.final(),
  ]).toString("utf8")
}

type TokenResponse = {
  access_token: string
  refresh_token: string
  expires_in: number
}

export async function exchangeCode(
  code: string,
  verifier: string,
  redirectUri: string
): Promise<TokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.LINEAR_OAUTH_CLIENT_ID!,
      client_secret: process.env.LINEAR_OAUTH_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      code,
      code_verifier: verifier,
    }),
    cache: "no-store",
  })
  if (!response.ok) throw new Error("Linear rechazó la autorización.")
  return response.json()
}

export async function getWorkspaceToken(workspaceId: string): Promise<string> {
  const [{ db }, { linearWorkspaces }] = await Promise.all([
    import("@/lib/db/client"),
    import("@/lib/db/schema"),
  ])
  const [workspace] = await db
    .select()
    .from(linearWorkspaces)
    .where(eq(linearWorkspaces.id, workspaceId))
    .limit(1)
  if (
    !workspace ||
    workspace.connectionStatus !== "connected" ||
    !workspace.accessToken ||
    !workspace.refreshToken ||
    !workspace.tokenExpiresAt
  )
    throw new Error("El workspace de Linear necesita reconexión.")
  if (workspace.tokenExpiresAt.getTime() > Date.now() + 60_000)
    return decryptToken(workspace.accessToken)
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.LINEAR_OAUTH_CLIENT_ID!,
      client_secret: process.env.LINEAR_OAUTH_CLIENT_SECRET!,
      refresh_token: decryptToken(workspace.refreshToken),
    }),
    cache: "no-store",
  })
  if (!response.ok) {
    const [latest] = await db
      .select()
      .from(linearWorkspaces)
      .where(eq(linearWorkspaces.id, workspaceId))
      .limit(1)
    if (latest?.refreshToken !== workspace.refreshToken && latest?.accessToken)
      return decryptToken(latest.accessToken)
    await db
      .update(linearWorkspaces)
      .set({ connectionStatus: "reconnect" })
      .where(eq(linearWorkspaces.id, workspaceId))
    throw new Error(
      "La conexión con Linear venció. Un administrador debe reconectarla."
    )
  }
  const tokens = (await response.json()) as TokenResponse
  const [updated] = await db
    .update(linearWorkspaces)
    .set({
      accessToken: encryptToken(tokens.access_token),
      refreshToken: encryptToken(tokens.refresh_token),
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    })
    .where(eq(linearWorkspaces.refreshToken, workspace.refreshToken))
    .returning({ id: linearWorkspaces.id })
  if (updated) return tokens.access_token
  const [latest] = await db
    .select()
    .from(linearWorkspaces)
    .where(eq(linearWorkspaces.id, workspaceId))
    .limit(1)
  if (!latest?.accessToken)
    throw new Error("No se pudo renovar la conexión con Linear.")
  return decryptToken(latest.accessToken)
}

export async function markWorkspaceReconnect(
  workspaceId: string
): Promise<void> {
  const [{ db }, { linearWorkspaces }] = await Promise.all([
    import("@/lib/db/client"),
    import("@/lib/db/schema"),
  ])
  await db
    .update(linearWorkspaces)
    .set({ connectionStatus: "reconnect" })
    .where(eq(linearWorkspaces.id, workspaceId))
}

export async function linearGraphql<T>(
  token: string,
  query: string,
  variables: Record<string, unknown> = {}
): Promise<T> {
  const response = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  })
  const body = await response.json()
  if (!response.ok || body.errors?.length)
    throw new Error(body.errors?.[0]?.message ?? "Linear no respondió.")
  return body.data as T
}
