import type { Graph } from "@/lib/graph/build"
import type { Node } from "@/lib/schema/snapshot"

/** Every node reachable from `start` following `map` (preds or succs). */
export function walk(
  start: string,
  map: Record<string, string[]>
): Set<string> {
  const out = new Set<string>()
  const queue = [...(map[start] ?? [])]
  while (queue.length) {
    const next = queue.pop()!
    if (out.has(next)) continue
    out.add(next)
    ;(map[next] ?? []).forEach((x) => queue.push(x))
  }
  return out
}

export type Bottleneck = {
  id: string
  downstreamCount: number
  downstreamPoints: number
}

/** Open (not-yet-started-blocking) issues ranked by how much they hold up. */
export function bottlenecks(graph: Graph): Bottleneck[] {
  return Object.keys(graph.nodesById)
    .filter(
      (id) =>
        graph.nodesById[id].type !== "completed" &&
        (graph.succs[id] ?? []).length > 0
    )
    .map((id) => {
      const downstream = walk(id, graph.succs)
      return {
        id,
        downstreamCount: downstream.size,
        downstreamPoints: [...downstream].reduce(
          (sum, d) => sum + (graph.nodesById[d]?.pts ?? 0),
          0
        ),
      }
    })
    .sort(
      (a, b) =>
        b.downstreamCount - a.downstreamCount ||
        b.downstreamPoints - a.downstreamPoints
    )
}

/** Edges A -> B where A hasn't reached statusType "completed" yet. */
export function openBlocks(graph: Graph): Array<[string, string]> {
  const result: Array<[string, string]> = []
  for (const [a, targets] of Object.entries(graph.succs)) {
    const blocker = graph.nodesById[a]
    if (!blocker || blocker.type === "completed") continue
    for (const b of targets) result.push([a, b])
  }
  return result
}

/** Longest path in the DAG — the floor of how fast the cycle can go. */
export function longestChain(graph: Graph): string[] {
  const memo: Record<string, string[]> = {}

  function longest(id: string, visiting: Set<string>): string[] {
    if (memo[id]) return memo[id]
    if (visiting.has(id)) return [id]

    visiting.add(id)
    const candidates = (graph.succs[id] ?? []).map((s) => longest(s, visiting))
    visiting.delete(id)

    const best = candidates.sort((a, b) => b.length - a.length)[0] ?? []
    const result = [id, ...best]
    memo[id] = result
    return result
  }

  const roots = Object.keys(graph.nodesById).filter(
    (id) => (graph.preds[id] ?? []).length === 0
  )
  const chains = roots.map((id) => longest(id, new Set()))
  return chains.sort((a, b) => b.length - a.length)[0] ?? []
}

export type StrandedChildren = {
  parent: string
  total: number
  outside: string[]
}

/** In-cycle issues whose sub-issues (hierarchy, not blocking) leaked out. */
export function strandedChildren(nodes: Node[]): StrandedChildren[] {
  return nodes
    .filter((n) => n.isEpic)
    .map((parent) => {
      const children = nodes.filter((n) => n.parent === parent.id && !n.isEpic)
      return {
        parent: parent.id,
        total: children.length,
        outside: children.filter((n) => !n.inCycle).map((n) => n.id),
      }
    })
    .filter((entry) => entry.total > entry.outside.length)
}

export type CriticalPathLoad = {
  who: string
  issuesOnPath: number
  openIssues: number
}

/** Who's on the critical chain, and how many other open fronts they're on. */
export function criticalPathLoad(
  chain: string[],
  nodes: Node[]
): CriticalPathLoad[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const people = new Set(
    chain
      .map((id) => byId.get(id)?.who)
      .filter((who): who is string => Boolean(who))
  )

  return [...people].map((who) => ({
    who,
    issuesOnPath: chain.filter((id) => byId.get(id)?.who === who).length,
    openIssues: nodes.filter(
      (n) => !n.isEpic && n.who === who && n.inCycle && n.type !== "completed"
    ).length,
  }))
}
