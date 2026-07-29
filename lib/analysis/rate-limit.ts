import "server-only"

import { countAnalysesToday } from "@/lib/db/queries"

/** Hard daily cap on regenerations (preplan §2.7) — part of M3, not an afterthought. */
export async function checkAnalysisRateLimit(): Promise<{
  allowed: boolean
  usedToday: number
  limit: number
}> {
  const limit = Number(process.env.MAX_ANALYSES_PER_DAY ?? "10")
  const usedToday = await countAnalysesToday()
  return { allowed: usedToday < limit, usedToday, limit }
}
