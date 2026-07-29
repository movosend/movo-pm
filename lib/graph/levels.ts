import type { Graph } from "@/lib/graph/build"

/**
 * Topological depth per node (0 = nothing blocks it). Uses a per-path
 * `visiting` set (recursion stack only, not a permanent "seen" set) so a
 * cycle cuts recursion at the repeated node instead of hanging, without
 * poisoning unrelated branches that happen to share a node.
 */
export function topoLevels(graph: Graph): Record<string, number> {
  const level: Record<string, number> = {}

  function resolve(id: string, visiting: Set<string>): number {
    if (level[id] !== undefined) return level[id]
    if (visiting.has(id)) return 0

    visiting.add(id)
    const preds = graph.preds[id] ?? []
    const value = preds.length
      ? Math.max(...preds.map((p) => resolve(p, visiting))) + 1
      : 0
    visiting.delete(id)

    level[id] = value
    return value
  }

  for (const id of Object.keys(graph.nodesById)) resolve(id, new Set())

  return level
}
