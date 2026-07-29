import { buildGraph } from "@/lib/graph/build"
import { openBlocks } from "@/lib/graph/metrics"
import type { Snapshot } from "@/lib/schema/snapshot"

export type SnapshotDiff = {
  resolved: Array<[string, string]>
  new: Array<[string, string]>
  unchanged: Array<[string, string]>
  /** Unchanged edges whose blocker didn't move status at all — the ones
   *  that survived a planning without anyone touching them. */
  worsened: Array<[string, string]>
}

export function diff(prev: Snapshot, next: Snapshot): SnapshotDiff {
  const key = ([a, b]: [string, string]) => `${a}|${b}`

  const prevOpen = openBlocks(buildGraph(prev))
  const nextOpen = openBlocks(buildGraph(next))
  const prevKeys = new Set(prevOpen.map(key))
  const nextKeys = new Set(nextOpen.map(key))

  const resolved = prevOpen.filter((e) => !nextKeys.has(key(e)))
  const newBlocks = nextOpen.filter((e) => !prevKeys.has(key(e)))
  const unchanged = nextOpen.filter((e) => prevKeys.has(key(e)))

  const prevById = new Map(prev.nodes.map((n) => [n.id, n]))
  const nextById = new Map(next.nodes.map((n) => [n.id, n]))
  const worsened = unchanged.filter(([a]) => {
    const before = prevById.get(a)
    const after = nextById.get(a)
    return Boolean(before && after && before.status === after.status)
  })

  return { resolved, new: newBlocks, unchanged, worsened }
}
