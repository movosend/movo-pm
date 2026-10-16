import { layoutGraph } from "@/lib/graph/layout"
import type { Snapshot } from "@/lib/schema/snapshot"

export const PLANNING_CARD = {
  nodeWidth: 244,
  nodeHeight: 88,
  columnWidth: 320,
  rowHeight: 118,
}

/** Shared by the interactive canvas and its thumbnail, including isolated US. */
export function planningLayout(snapshot: Snapshot) {
  const result = layoutGraph(snapshot, {
    showOutside: true,
    metrics: PLANNING_CARD,
  })
  result.orphans.forEach((id, index) => {
    result.pos[id] = {
      x: 46 + (index % 3) * PLANNING_CARD.columnWidth,
      y: result.height + 30 + Math.floor(index / 3) * PLANNING_CARD.rowHeight,
    }
  })
  return result
}
