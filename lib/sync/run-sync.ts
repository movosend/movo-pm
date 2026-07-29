import "server-only"

import {
  getLatestSnapshot,
  insertSnapshot,
  insertSyncLog,
  snapshotContentHash,
} from "@/lib/db/queries"
import { getLinearSource } from "@/lib/linear/client"
import type { Snapshot } from "@/lib/schema/snapshot"

export type SyncSource = "webhook" | "poll" | "manual"

/** Shared by the manual sync route, the Linear webhook, and client polling. */
export async function runSync(
  source: SyncSource
): Promise<{ snapshot: Snapshot; changed: boolean }> {
  try {
    const linearSource = getLinearSource()
    const snapshot = await linearSource.getActiveCycleSnapshot()
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

    await insertSyncLog({ source, changed })
    return { snapshot, changed }
  } catch (error) {
    const message = error instanceof Error ? error.message : "sync failed"
    await insertSyncLog({ source, changed: false, error: message })
    throw error
  }
}
