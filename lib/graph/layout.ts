import type { Snapshot } from "@/lib/schema/snapshot"

// Card geometry, ported 1:1 from docs/mockup.html (NW/NH/COL/ROW/PAD).
export const LAYOUT_METRICS = {
  nodeWidth: 206,
  nodeHeight: 64,
  columnWidth: 282,
  rowHeight: 86,
  padding: 46,
}

export type LayoutOptions = {
  /** Mirrors the mockup's "Fuera del ciclo" toggle. */
  showOutside: boolean
}

export type LayoutResult = {
  pos: Record<string, { x: number; y: number }>
  edges: Array<[string, string]>
  preds: Record<string, string[]>
  succs: Record<string, string[]>
  orphans: string[]
  cols: string[][]
  height: number
}

/**
 * Topological-level columns + 4-pass barycenter sort to reduce edge
 * crossings. Ported literal from docs/mockup.html's layout() (already
 * validated against real data) — per the preplan, don't rewrite this
 * unless a cycle actually approaches ~60 issues.
 */
export function layoutGraph(
  snapshot: Snapshot,
  options: LayoutOptions
): LayoutResult {
  const { nodeHeight, columnWidth, rowHeight, padding } = LAYOUT_METRICS

  const visible = new Set(
    snapshot.nodes
      .filter((n) => n.inCycle || options.showOutside)
      .map((n) => n.id)
  )
  const edges = snapshot.blocks.filter(
    ([a, b]) => visible.has(a) && visible.has(b)
  ) as Array<[string, string]>

  const preds: Record<string, string[]> = {}
  const succs: Record<string, string[]> = {}
  visible.forEach((id) => {
    preds[id] = []
    succs[id] = []
  })
  edges.forEach(([a, b]) => {
    succs[a].push(b)
    preds[b].push(a)
  })

  const nodesById = new Map(snapshot.nodes.map((n) => [n.id, n]))
  const connected = [...visible].filter(
    (id) => preds[id].length || succs[id].length
  )
  const orphans = [...visible].filter(
    (id) => !preds[id].length && !succs[id].length && nodesById.get(id)?.inCycle
  )

  const level: Record<string, number> = {}
  const resolve = (id: string, seen: Set<string>): number => {
    if (level[id] !== undefined) return level[id]
    if (seen.has(id)) return 0
    seen.add(id)
    const value = preds[id].length
      ? Math.max(...preds[id].map((p) => resolve(p, seen))) + 1
      : 0
    level[id] = value
    return value
  }
  connected.forEach((id) => resolve(id, new Set()))

  const maxLevel = connected.length
    ? Math.max(...connected.map((id) => level[id]))
    : 0
  const cols: string[][] = Array.from({ length: maxLevel + 1 }, (_, l) =>
    connected.filter((id) => level[id] === l)
  )

  const order: Record<string, number> = {}
  cols.forEach((col) => col.forEach((id, i) => (order[id] = i)))

  for (let pass = 0; pass < 4; pass++) {
    const forward = pass % 2 === 0
    const sequence = cols.map((_, i) => i)
    if (!forward) sequence.reverse()

    sequence.forEach((l) => {
      const rel = forward ? preds : succs
      cols[l] = [...cols[l]].sort((a, b) => {
        const barycenter = (id: string) => {
          const related = (rel[id] ?? []).filter((x) => level[x] !== undefined)
          return related.length
            ? related.reduce((sum, x) => sum + order[x], 0) / related.length
            : order[id]
        }
        return barycenter(a) - barycenter(b)
      })
      cols[l].forEach((id, i) => (order[id] = i))
    })
  }

  const tallest = Math.max(1, ...cols.map((c) => c.length))
  const pos: Record<string, { x: number; y: number }> = {}
  cols.forEach((col, l) => {
    const offset = (tallest - col.length) / 2
    col.forEach((id, i) => {
      pos[id] = {
        x: padding + l * columnWidth,
        y: padding + (i + offset) * rowHeight,
      }
    })
  })

  return {
    pos,
    edges,
    preds,
    succs,
    orphans,
    cols,
    height: padding * 2 + tallest * rowHeight - (rowHeight - nodeHeight),
  }
}
