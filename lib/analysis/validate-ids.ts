import type { Analysis, Snapshot } from "@/lib/schema/snapshot"

/**
 * The cheapest guardrail against hallucination (preplan §5.2): any issue id
 * the model invents gets dropped from that decision, and it's logged rather
 * than silently kept or thrown away without a trace.
 */
export function validateAnalysisIds(
  analysis: Analysis,
  snapshot: Snapshot
): Analysis {
  const validIds = new Set(snapshot.nodes.map((n) => n.id))

  const decisions = analysis.decisions.map((decision) => {
    const issues = decision.issues.filter((id) => {
      const valid = validIds.has(id)
      if (!valid) {
        console.warn(
          `[analysis] discarded hallucinated issue id "${id}" in decision "${decision.title}"`
        )
      }
      return valid
    })
    return { ...decision, issues }
  })

  return { ...analysis, decisions }
}
