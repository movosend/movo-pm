import dagre from "@dagrejs/dagre"

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
  metrics?: Partial<typeof LAYOUT_METRICS>
}

export type Point = { x: number; y: number }

export type LayoutResult = {
  pos: Record<string, { x: number; y: number }>
  edges: Array<[string, string]>
  /** Routed waypoints per edge (dagre inserts bends around intermediate
   * nodes via dummy nodes), keyed by "sourceId|targetId". */
  edgeRoutes: Record<string, Point[]>
  preds: Record<string, string[]>
  succs: Record<string, string[]>
  orphans: string[]
  cols: string[][]
  height: number
}

/**
 * Layered layout via dagre (Sugiyama-style ranking + crossing
 * minimization + dummy-node edge routing). Node ranks map to the
 * "Nivel N" columns; ranksep/nodesep are pinned to LAYOUT_METRICS so the
 * result keeps the same fixed-grid look as the previous hand-rolled
 * layout, while dagre handles ordering and edge routing quality.
 */
export function layoutGraph(
  snapshot: Snapshot,
  options: LayoutOptions
): LayoutResult {
  const { nodeWidth, nodeHeight, columnWidth, rowHeight, padding } = {
    ...LAYOUT_METRICS,
    ...options.metrics,
  }

  const visible = new Set(
    snapshot.nodes
      .filter((n) => n.isEpic !== true && (n.inCycle || options.showOutside))
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

  const connected = [...visible].filter(
    (id) => preds[id].length || succs[id].length
  )
  const orphans = [...visible].filter(
    (id) => !preds[id].length && !succs[id].length
  )

  const pos: Record<string, Point> = {}
  const edgeRoutes: Record<string, Point[]> = {}
  const cols: string[][] = []
  let height = padding * 2

  if (connected.length) {
    // ASAP levels (longest path from roots): a node's level is how many
    // blocking edges are chained in front of it, with sources at 0. None
    // of dagre's built-in rankers reproduce this on their own — they
    // minimize total edge length, so a source with a single successor
    // floats to "just before" that successor instead of anchoring at 0
    // when the successor's true depth comes from a longer unrelated
    // chain. Passing the level gap as each edge's `minlen` removes all
    // slack, forcing dagre's rank phase (any ranker) to reproduce these
    // levels exactly while still handling ordering and edge routing.
    const level: Record<string, number> = {}
    const resolveLevel = (id: string, seen: Set<string>): number => {
      if (level[id] !== undefined) return level[id]
      if (seen.has(id)) return 0
      seen.add(id)
      const value = preds[id].length
        ? Math.max(...preds[id].map((p) => resolveLevel(p, seen))) + 1
        : 0
      level[id] = value
      return value
    }
    connected.forEach((id) => resolveLevel(id, new Set()))

    const g = new dagre.graphlib.Graph()
    g.setGraph({
      rankdir: "LR",
      nodesep: rowHeight - nodeHeight,
      ranksep: columnWidth - nodeWidth,
      marginx: 0,
      marginy: 0,
    })
    g.setDefaultEdgeLabel(() => ({}))

    connected.forEach((id) =>
      g.setNode(id, { width: nodeWidth, height: nodeHeight })
    )
    edges.forEach(([a, b]) => g.setEdge(a, b, { minlen: level[b] - level[a] }))

    dagre.layout(g)

    // dagre positions are node centers; shift everything so the graph
    // starts at (padding, padding), matching the previous grid's origin.
    const minX = Math.min(
      ...connected.map((id) => g.node(id).x - nodeWidth / 2)
    )
    const minY = Math.min(
      ...connected.map((id) => g.node(id).y - nodeHeight / 2)
    )
    const shiftX = padding - minX
    const shiftY = padding - minY

    connected.forEach((id) => {
      const n = g.node(id)
      pos[id] = {
        x: n.x - nodeWidth / 2 + shiftX,
        y: n.y - nodeHeight / 2 + shiftY,
      }
    })

    edges.forEach(([a, b]) => {
      const e = g.edge(a, b)
      const points = (e?.points ?? []).map((p: Point) => ({
        x: p.x + shiftX,
        y: p.y + shiftY,
      }))
      edgeRoutes[`${a}|${b}`] = points.length
        ? points
        : [pos[a], pos[b]].filter(Boolean)
    })

    // Group nodes into columns by rank (shared x) purely for the "Nivel N"
    // headers/dividers — layout itself no longer depends on this grid.
    const xs = [...new Set(connected.map((id) => Math.round(pos[id].x)))].sort(
      (a, b) => a - b
    )
    const colIndexByX = new Map(xs.map((x, i) => [x, i]))
    xs.forEach(() => cols.push([]))
    connected.forEach((id) => {
      cols[colIndexByX.get(Math.round(pos[id].x))!].push(id)
    })
    cols.forEach((col) => col.sort((a, b) => pos[a].y - pos[b].y))

    height =
      Math.max(...connected.map((id) => pos[id].y)) + nodeHeight + padding
  }

  return {
    pos,
    edges,
    edgeRoutes,
    preds,
    succs,
    orphans,
    cols,
    height,
  }
}
