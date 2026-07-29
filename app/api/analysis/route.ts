import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { generateAnalysis } from "@/lib/analysis/generate"
import { checkAnalysisRateLimit } from "@/lib/analysis/rate-limit"
import {
  getLatestSnapshot,
  insertAnalysis,
  updateSnapshotAnalysis,
} from "@/lib/db/queries"
import type { Snapshot } from "@/lib/schema/snapshot"

export async function POST() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const rateLimit = await checkAnalysisRateLimit()
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: `Límite de ${rateLimit.limit} regeneraciones por día alcanzado.`,
      },
      { status: 429 }
    )
  }

  const row = await getLatestSnapshot(process.env.LINEAR_TEAM_KEY!)
  if (!row) {
    return NextResponse.json(
      { error: "No hay un snapshot todavía. Sincronizá primero." },
      { status: 404 }
    )
  }

  const snapshot = row.payload as Snapshot
  const result = await generateAnalysis(snapshot, null)

  await insertAnalysis({
    snapshotId: row.id,
    model: result.model,
    payload: result.analysis ?? {
      generated: new Date().toISOString(),
      headline: "",
      decisions: [],
      watchNext: [],
    },
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  })

  const updatedSnapshot: Snapshot = { ...snapshot, analysis: result.analysis }
  await updateSnapshotAnalysis(row.id, updatedSnapshot)

  return NextResponse.json({ analysis: result.analysis })
}
