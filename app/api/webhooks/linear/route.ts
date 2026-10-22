import { createHmac, timingSafeEqual } from "node:crypto"

import { after, NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { linearTeams, linearWorkspaces } from "@/lib/db/schema"
import { withTeamContext } from "@/lib/workspaces/context"

import { runSync } from "@/lib/sync/run-sync"

// Recommended tolerance per Linear's docs — guards against replay attacks.
const REPLAY_TOLERANCE_MS = 60_000

function isValidSignature(rawBody: string, signature: string, secret: string) {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex")
  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  return (
    signatureBuffer.length === expectedBuffer.length &&
    timingSafeEqual(signatureBuffer, expectedBuffer)
  )
}

export async function POST(request: Request) {
  const oauthSecret = process.env.LINEAR_OAUTH_WEBHOOK_SECRET
  const legacySecret = process.env.LINEAR_WEBHOOK_SECRET
  if (!oauthSecret && !legacySecret) {
    return NextResponse.json(
      { error: "webhook not configured" },
      { status: 503 }
    )
  }

  const rawBody = await request.text()
  const signature = request.headers.get("linear-signature")
  const oauthSigned = Boolean(
    signature &&
    oauthSecret &&
    isValidSignature(rawBody, signature, oauthSecret)
  )
  const legacySigned = Boolean(
    signature &&
    legacySecret &&
    isValidSignature(rawBody, signature, legacySecret)
  )
  if (!oauthSigned && !legacySigned) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 })
  }

  let payload: {
    webhookTimestamp?: number
    organizationId?: string
    type?: string
    action?: string
    oauthClientId?: string
  }
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 })
  }

  if (
    typeof payload.webhookTimestamp !== "number" ||
    Math.abs(Date.now() - payload.webhookTimestamp) > REPLAY_TOLERANCE_MS
  ) {
    return NextResponse.json({ error: "stale webhook" }, { status: 401 })
  }

  if (oauthSigned && !payload.organizationId)
    return NextResponse.json({ error: "missing organization" }, { status: 400 })
  const [workspace] =
    oauthSigned && payload.organizationId
      ? await db
          .select()
          .from(linearWorkspaces)
          .where(eq(linearWorkspaces.organizationId, payload.organizationId))
          .limit(1)
      : await db
          .select()
          .from(linearWorkspaces)
          .where(
            eq(linearWorkspaces.id, "00000000-0000-4000-8000-000000000001")
          )
          .limit(1)
  if (!workspace)
    return NextResponse.json({ error: "unknown workspace" }, { status: 404 })
  if (payload.type === "OAuthApp" && payload.action === "revoked") {
    if (payload.oauthClientId !== process.env.LINEAR_OAUTH_CLIENT_ID)
      return NextResponse.json(
        { error: "unknown application" },
        { status: 404 }
      )
    await db
      .update(linearWorkspaces)
      .set({ connectionStatus: "reconnect" })
      .where(eq(linearWorkspaces.id, workspace.id))
    return NextResponse.json({ ok: true })
  }
  const teams = await db
    .select()
    .from(linearTeams)
    .where(eq(linearTeams.workspaceId, workspace.id))
  after(async () => {
    await Promise.allSettled(
      teams
        .filter((team) => team.enabled)
        .map((team) =>
          withTeamContext(
            {
              id: team.id,
              workspaceId: workspace.id,
              key: team.key,
              workspaceSlug: workspace.slug,
              connectionStatus: workspace.connectionStatus,
            },
            () => runSync("webhook")
          )
        )
    )
  })
  return NextResponse.json({ ok: true })
}

export const maxDuration = 300
