import type { IssueDetail, Node, Snapshot } from "@/lib/schema/snapshot"
import { planningGraph } from "./graph"
import { planningLayout, PLANNING_CARD } from "./layout"

export function buildStagePreview(
  identifiers: string[],
  details: IssueDetail[]
) {
  const included = new Set(identifiers)
  const nodes = new Map<string, Node>()
  details.forEach((detail) =>
    detail.nodes.forEach((node) => nodes.set(node.id, node))
  )
  // A root has more complete fields than its occurrence in another issue's context.
  details.forEach((detail) => {
    const root = detail.nodes[0]
    if (root) nodes.set(root.id, root)
  })
  const snapshot: Snapshot = {
    cycle: {
      id: "planning",
      number: 0,
      team: "",
      name: "",
      start: "",
      end: "",
      taken: "",
      live: false,
      workspace: "",
    },
    nodes: [...nodes.values()],
    blocks: details.flatMap((detail) => detail.blocks),
    states: [],
    members: [],
    analysis: null,
  }
  const graph = planningGraph(snapshot, included, false)
  const layout = planningLayout(graph)
  const points = Object.values(layout.pos)
  return {
    count: identifiers.length,
    width:
      Math.max(0, ...points.map((p) => p.x)) + PLANNING_CARD.nodeWidth + 46,
    height:
      Math.max(0, ...points.map((p) => p.y)) + PLANNING_CARD.nodeHeight + 46,
    nodes: graph.nodes.map((node) => ({
      id: node.id,
      short: node.short,
      status: node.status,
      type: node.type,
      included: included.has(node.id),
      ...layout.pos[node.id],
    })),
    edges: layout.edges.map(([a, b]) => ({
      id: `${a}|${b}`,
      points: layout.edgeRoutes[`${a}|${b}`] ?? [],
      suggested: !included.has(a) || !included.has(b),
    })),
  }
}
export type StagePreview = ReturnType<typeof buildStagePreview>
