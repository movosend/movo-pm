import { buildGraph } from "@/lib/graph/build"
import {
  bottlenecks,
  criticalPathLoad,
  longestChain,
  openBlocks,
  strandedChildren,
} from "@/lib/graph/metrics"
import { diff as diffSnapshots } from "@/lib/graph/diff"
import { extractSignals } from "@/lib/analysis/extract-signals"
import type { Snapshot } from "@/lib/schema/snapshot"

const MONTHS: Record<string, number> = {
  ene: 0,
  feb: 1,
  mar: 2,
  abr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dic: 11,
}

/** Best-effort parse of the display-only "27 jul" dates in Snapshot.cycle. */
function parseShortDate(input: string, referenceYear: number): Date | null {
  const match = input.trim().match(/^(\d{1,2})\s+([a-záéíóú]{3,})/i)
  if (!match) return null
  const month = MONTHS[match[2].slice(0, 3).toLowerCase()]
  if (month === undefined) return null
  return new Date(referenceYear, month, Number(match[1]))
}

function daysRemaining(end: string): number | null {
  const now = new Date()
  const endDate = parseShortDate(end, now.getFullYear())
  if (!endDate) return null
  const ms = endDate.getTime() - new Date(now.toDateString()).getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

/**
 * Assembles the model input per preplan §5.1/§2.6: computed metrics (never
 * recomputed by the model), issue summaries (no full descriptions — only
 * keyword-extracted signals), and the diff against the previous planning.
 */
export function buildAnalysisInput(
  snapshot: Snapshot,
  previous: Snapshot | null
) {
  const graph = buildGraph(snapshot)
  const chain = longestChain(graph)

  return {
    cycle: {
      team: snapshot.cycle.team,
      name: snapshot.cycle.name,
      start: snapshot.cycle.start,
      end: snapshot.cycle.end,
      daysRemaining: daysRemaining(snapshot.cycle.end),
    },
    metrics: {
      bottlenecks: bottlenecks(graph),
      openBlocks: openBlocks(graph),
      longestChain: chain,
      epicContext: strandedChildren(snapshot.nodes),
      criticalPathLoad: criticalPathLoad(chain, snapshot.nodes),
    },
    issues: snapshot.nodes
      .filter((n) => !n.isEpic)
      .map((n) => ({
        id: n.id,
        title: n.title,
        status: n.status,
        type: n.type,
        pts: n.pts,
        who: n.who,
        parent: n.parent,
        inCycle: n.inCycle,
      })),
    blocks: snapshot.blocks.filter(
      ([a, b]) => graph.nodesById[a] && graph.nodesById[b]
    ),
    externalDependencySignals: extractSignals(snapshot.nodes),
    diffFromPreviousPlanning: previous
      ? diffSnapshots(previous, snapshot)
      : null,
  }
}
