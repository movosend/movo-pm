import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { runSync } from "@/lib/sync/run-sync"

export async function POST() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  try {
    const result = await runSync("manual")
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "sync failed"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
