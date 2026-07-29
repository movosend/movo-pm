import "server-only"

import { count, desc, eq, gte } from "drizzle-orm"

import { db } from "@/lib/db/client"
import { contentHash } from "@/lib/db/content-hash"
import { analyses, snapshots, syncLog } from "@/lib/db/schema"
import type { Analysis, Snapshot } from "@/lib/schema/snapshot"

/**
 * Hash only the parts of a Snapshot that reflect real Linear content.
 * `cycle.taken` and `cycle.live` change on every fetch even when nothing
 * moved in Linear, and `analysis` is generated independently (M3) — none
 * of those should trigger a new persisted snapshot.
 */
export function snapshotContentHash(snapshot: Snapshot): string {
  return contentHash({
    cycle: {
      team: snapshot.cycle.team,
      name: snapshot.cycle.name,
      start: snapshot.cycle.start,
      end: snapshot.cycle.end,
      workspace: snapshot.cycle.workspace,
    },
    nodes: snapshot.nodes,
    blocks: snapshot.blocks,
  })
}

export async function getLatestSnapshot(teamKey: string) {
  const [row] = await db
    .select()
    .from(snapshots)
    .where(eq(snapshots.teamKey, teamKey))
    .orderBy(desc(snapshots.takenAt))
    .limit(1)

  return row ?? null
}

export async function insertSnapshot(params: {
  cycleId: string
  teamKey: string
  payload: Snapshot
  contentHash: string
}) {
  const [row] = await db
    .insert(snapshots)
    .values({
      cycleId: params.cycleId,
      teamKey: params.teamKey,
      payload: params.payload,
      contentHash: params.contentHash,
    })
    .returning()

  return row
}

export async function insertSyncLog(params: {
  source: "webhook" | "poll" | "manual"
  changed: boolean
  error?: string
}) {
  await db.insert(syncLog).values({
    source: params.source,
    changed: params.changed,
    error: params.error ?? null,
  })
}

export async function countAnalysesToday(): Promise<number> {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const [row] = await db
    .select({ value: count() })
    .from(analyses)
    .where(gte(analyses.generatedAt, startOfDay))

  return row?.value ?? 0
}

export async function updateSnapshotAnalysis(
  snapshotId: string,
  payload: Snapshot
) {
  await db
    .update(snapshots)
    .set({ payload })
    .where(eq(snapshots.id, snapshotId))
}

export async function insertAnalysis(params: {
  snapshotId: string
  model: string
  payload: Analysis
  inputTokens: number
  outputTokens: number
}) {
  const [row] = await db
    .insert(analyses)
    .values({
      snapshotId: params.snapshotId,
      model: params.model,
      payload: params.payload,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
    })
    .returning()

  return row
}
