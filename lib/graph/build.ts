import type { Node, Snapshot } from "@/lib/schema/snapshot"

export type Graph = {
  nodesById: Record<string, Node>
  preds: Record<string, string[]>
  succs: Record<string, string[]>
  /** Cycle nodes with no declared blocking relation at all (glossary: Huérfano). */
  orphans: string[]
}

/**
 * Builds the predecessor/successor maps over every node in the snapshot
 * (in-cycle and out-of-cycle context nodes alike) — visibility toggles are
 * a UI concern (see lib/graph/layout.ts), not something the engine decides.
 *
 * Edges pointing at an id absent from `nodes` (e.g. a relation to an issue
 * from another team, which the CycleGraph query never fetched) are dropped
 * rather than crashing — the domain glossary is explicit that the graph
 * only sees what's declared and reachable.
 */
export function buildGraph(snapshot: Snapshot): Graph {
  const nodesById: Record<string, Node> = {}
  const preds: Record<string, string[]> = {}
  const succs: Record<string, string[]> = {}

  for (const node of snapshot.nodes) {
    nodesById[node.id] = node
    preds[node.id] = []
    succs[node.id] = []
  }

  for (const [a, b] of snapshot.blocks) {
    if (!(a in nodesById) || !(b in nodesById)) continue
    succs[a].push(b)
    preds[b].push(a)
  }

  const orphans = snapshot.nodes
    .filter(
      (n) => n.inCycle && preds[n.id].length === 0 && succs[n.id].length === 0
    )
    .map((n) => n.id)

  return { nodesById, preds, succs, orphans }
}
