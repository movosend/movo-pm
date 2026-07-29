import "server-only"

import { estimateCostFromUsage } from "@/lib/analysis/pricing"

const ADMIN_API_BASE = "https://api.anthropic.com/v1/organizations"

function adminHeaders(key: string) {
  return {
    "anthropic-version": "2023-06-01",
    "x-api-key": key,
  }
}

async function adminFetch(path: string, params: URLSearchParams) {
  const key = process.env.ANTHROPIC_ADMIN_API_KEY
  if (!key) return null

  const res = await fetch(`${ADMIN_API_BASE}${path}?${params}`, {
    headers: adminHeaders(key),
    cache: "no-store",
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Anthropic Admin API respondió ${res.status}: ${body}`)
  }

  return res.json()
}

type CostReportResponse = {
  data: { results: { amount: string }[] }[]
  has_more: boolean
  next_page: string | null
}

/**
 * Real, billed cost for fully-closed UTC days from Anthropic's Cost Report.
 * The current (still open) day is never included by this endpoint — it's
 * only finalized once the day ends — so callers should pass an `endingAt`
 * no later than the start of today and add `getTodayUsageEstimate` on top.
 */
async function getClosedDaysCostUsd(
  startingAt: Date,
  endingAt: Date
): Promise<number | null> {
  if (endingAt.getTime() <= startingAt.getTime()) return 0

  let totalCents = 0
  let page: string | undefined

  do {
    const params = new URLSearchParams({
      starting_at: startingAt.toISOString(),
      ending_at: endingAt.toISOString(),
    })
    if (page) params.set("page", page)

    const json = (await adminFetch(
      "/cost_report",
      params
    )) as CostReportResponse | null
    if (!json) return null

    for (const bucket of json.data) {
      for (const result of bucket.results) {
        totalCents += Number(result.amount)
      }
    }

    page = json.has_more ? (json.next_page ?? undefined) : undefined
  } while (page)

  return totalCents / 100
}

type UsageReportResult = {
  uncached_input_tokens: number
  cache_read_input_tokens: number
  cache_creation: {
    ephemeral_5m_input_tokens: number
    ephemeral_1h_input_tokens: number
  }
  output_tokens: number
  model: string
}

type UsageReportResponse = {
  data: { results: UsageReportResult[] }[]
  has_more: boolean
  next_page: string | null
}

/**
 * Estimated spend for today, from Anthropic's own (near real-time) Usage
 * API — unlike the Cost Report, this reflects usage within minutes, but the
 * $ figure is computed locally from our pricing table rather than Anthropic's
 * own billing, so it's an estimate, not the final number.
 */
async function getTodayUsageEstimateUsd(
  todayStart: Date,
  now: Date
): Promise<number | null> {
  if (now.getTime() <= todayStart.getTime()) return 0

  let total = 0
  let page: string | undefined

  do {
    const params = new URLSearchParams({
      starting_at: todayStart.toISOString(),
      ending_at: now.toISOString(),
      bucket_width: "1h",
    })
    params.append("group_by[]", "model")
    if (page) params.set("page", page)

    const json = (await adminFetch(
      "/usage_report/messages",
      params
    )) as UsageReportResponse | null
    if (!json) return null

    for (const bucket of json.data) {
      for (const result of bucket.results) {
        total += estimateCostFromUsage(result.model, {
          uncachedInputTokens: result.uncached_input_tokens,
          cacheReadInputTokens: result.cache_read_input_tokens,
          cacheCreation5mInputTokens:
            result.cache_creation?.ephemeral_5m_input_tokens ?? 0,
          cacheCreation1hInputTokens:
            result.cache_creation?.ephemeral_1h_input_tokens ?? 0,
          outputTokens: result.output_tokens,
        })
      }
    }

    page = json.has_more ? (json.next_page ?? undefined) : undefined
  } while (page)

  return total
}

export type RealCostSummary = {
  closedDaysUsd: number
  todayEstimateUsd: number
  totalUsd: number
}

export async function getRealCostSummary(
  monthStart: Date
): Promise<RealCostSummary | null> {
  if (!process.env.ANTHROPIC_ADMIN_API_KEY) return null

  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setUTCHours(0, 0, 0, 0)

  const [closedDaysUsd, todayEstimateUsd] = await Promise.all([
    getClosedDaysCostUsd(monthStart, todayStart),
    getTodayUsageEstimateUsd(todayStart, now),
  ])

  if (closedDaysUsd === null || todayEstimateUsd === null) return null

  return {
    closedDaysUsd,
    todayEstimateUsd,
    totalUsd: closedDaysUsd + todayEstimateUsd,
  }
}
