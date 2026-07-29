import { NextResponse } from "next/server"

import { auth } from "@/auth"
import {
  getLatestSnapshot,
  insertSnapshot,
  insertSyncLog,
  snapshotContentHash,
} from "@/lib/db/queries"
import { getLinearSource } from "@/lib/linear/client"

export async function POST() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  try {
    const source = getLinearSource()
    const snapshot = await source.getActiveCycleSnapshot()
    const hash = snapshotContentHash(snapshot)

    const latest = await getLatestSnapshot(process.env.LINEAR_TEAM_KEY!)
    const changed = latest?.contentHash !== hash

    if (changed) {
      await insertSnapshot({
        cycleId: snapshot.cycle.name,
        teamKey: process.env.LINEAR_TEAM_KEY!,
        payload: snapshot,
        contentHash: hash,
      })
    }

    await insertSyncLog({ source: "manual", changed })

    return NextResponse.json({ snapshot, changed })
  } catch (error) {
    const message = error instanceof Error ? error.message : "sync failed"
    await insertSyncLog({ source: "manual", changed: false, error: message })
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
