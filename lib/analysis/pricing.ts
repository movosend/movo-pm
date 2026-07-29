import "server-only"

const INTRO_PRICING_ENDS_AT = new Date("2026-09-01T00:00:00Z")

type Rates = { inputPerMTok: number; outputPerMTok: number }

function ratesFor(model: string): Rates | null {
  if (model.startsWith("claude-sonnet-5")) {
    const useIntro = Date.now() < INTRO_PRICING_ENDS_AT.getTime()
    return useIntro
      ? { inputPerMTok: 2.0, outputPerMTok: 10.0 }
      : { inputPerMTok: 3.0, outputPerMTok: 15.0 }
  }
  if (model.startsWith("claude-opus-5")) {
    return { inputPerMTok: 5.0, outputPerMTok: 25.0 }
  }
  return null
}

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const rates = ratesFor(model)
  if (!rates) return 0

  return (
    (inputTokens / 1_000_000) * rates.inputPerMTok +
    (outputTokens / 1_000_000) * rates.outputPerMTok
  )
}

/**
 * Cost from real Anthropic-measured token counts (Usage API), including the
 * cache read/write multipliers — used to estimate "today" spend before
 * Anthropic's Cost Report closes the day and publishes the final $ figure.
 */
export function estimateCostFromUsage(
  model: string,
  usage: {
    uncachedInputTokens: number
    cacheReadInputTokens: number
    cacheCreation5mInputTokens: number
    cacheCreation1hInputTokens: number
    outputTokens: number
  }
): number {
  const rates = ratesFor(model)
  if (!rates) return 0

  const inputRate = rates.inputPerMTok / 1_000_000
  return (
    usage.uncachedInputTokens * inputRate +
    usage.cacheReadInputTokens * inputRate * 0.1 +
    usage.cacheCreation5mInputTokens * inputRate * 1.25 +
    usage.cacheCreation1hInputTokens * inputRate * 2 +
    usage.outputTokens * (rates.outputPerMTok / 1_000_000)
  )
}
