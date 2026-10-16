import type { Snapshot } from "@/lib/schema/snapshot"
import { isPending } from "./types"

/** Only the one-hop frontier of included work is visible; selecting a ghost never expands it. */
export function planningGraph(
  snapshot: Snapshot,
  included: Set<string>,
  showResolved: boolean
): Snapshot {
  const visible = new Set(included)
  snapshot.blocks.forEach(([a, b]) => {
    if (included.has(a)) visible.add(b)
    if (included.has(b)) visible.add(a)
  })
  const nodes = snapshot.nodes.filter(
    (node) =>
      !node.isEpic &&
      visible.has(node.id) &&
      (included.has(node.id) || showResolved || isPending(node))
  )
  const ids = new Set(nodes.map((node) => node.id))
  const blocks = [
    ...new Map(
      snapshot.blocks
        .filter(([a, b]) => ids.has(a) && ids.has(b))
        .map((edge) => [edge.join("|"), edge])
    ).values(),
  ]
  return { ...snapshot, nodes, blocks }
}
