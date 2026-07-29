import { createHmac, timingSafeEqual } from "node:crypto"

import { NextResponse } from "next/server"

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
  const secret = process.env.LINEAR_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: "webhook not configured" },
      { status: 503 }
    )
  }

  const rawBody = await request.text()
  const signature = request.headers.get("linear-signature")
  if (!signature || !isValidSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 })
  }

  let payload: { webhookTimestamp?: number }
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

  try {
    await runSync("webhook")
  } catch (error) {
    const message = error instanceof Error ? error.message : "sync failed"
    return NextResponse.json({ error: message }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
