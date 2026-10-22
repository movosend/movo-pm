import { createHash, randomBytes } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/workspaces/access"

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 })
  }
  if (
    !process.env.LINEAR_OAUTH_CLIENT_ID ||
    !process.env.LINEAR_OAUTH_CLIENT_SECRET ||
    !process.env.LINEAR_TOKEN_ENCRYPTION_KEY
  )
    return NextResponse.json(
      { error: "Configurá OAuth de Linear en el servidor." },
      { status: 503 }
    )
  const state = randomBytes(32).toString("base64url")
  const verifier = randomBytes(32).toString("base64url")
  const challenge = createHash("sha256").update(verifier).digest("base64url")
  const redirectUri = new URL("/api/linear/callback", request.url).toString()
  const url = new URL("https://linear.app/oauth/authorize")
  url.search = new URLSearchParams({
    client_id: process.env.LINEAR_OAUTH_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "read,write",
    state,
    actor: "app",
    prompt: "consent",
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString()
  const response = NextResponse.redirect(url)
  const options = {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax" as const,
    maxAge: 600,
    path: "/api/linear",
  }
  response.cookies.set("linear_oauth_state", state, options)
  response.cookies.set("linear_oauth_verifier", verifier, options)
  return response
}
