import type { Graph } from "@/lib/graph/build"

/**
 * DFS with white/gray/black coloring. Linear lets a team create cyclic
 * `blocks` relations, and the domain invariant is that we must detect it
 * and keep rendering, never hang in recursion (preplan §1.2.1).
 */
export function detectCycles(graph: Graph): string[][] {
  const WHITE = 0
  const GRAY = 1
  const BLACK = 2

  const color: Record<string, number> = {}
  for (const id of Object.keys(graph.nodesById)) color[id] = WHITE

  const cycles: string[][] = []
  const stack: string[] = []

  function visit(id: string) {
    color[id] = GRAY
    stack.push(id)

    for (const next of graph.succs[id] ?? []) {
      if (color[next] === GRAY) {
        const start = stack.indexOf(next)
        cycles.push(stack.slice(start).concat(next))
      } else if (color[next] === WHITE) {
        visit(next)
      }
    }

    stack.pop()
    color[id] = BLACK
  }

  for (const id of Object.keys(graph.nodesById)) {
    if (color[id] === WHITE) visit(id)
  }

  return cycles
}
