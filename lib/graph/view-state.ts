import type { Graph } from "@/lib/graph/build"
import type { Node } from "@/lib/schema/snapshot"

export const CONDITIONS = {
  blocked: "Bloqueadas",
  ready: "Listas para empezar",
  unestimated: "Sin estimar",
  unassigned: "Sin responsable",
} as const
export type Condition = keyof typeof CONDITIONS
export type Filters = {
  assignees: string[]
  states: string[]
  conditions: Condition[]
}
export type Visibility =
  "showOutside" | "showParents" | "hideParents" | "showOrphans" | "hideOrphans"
export type ViewState = {
  filters: Filters
  active: Visibility[]
  selected: string | null
  cycle: string | null
}
export const emptyFilters = (): Filters => ({
  assignees: [],
  states: [],
  conditions: [],
})
export function hasFilters(filters: Filters) {
  return Boolean(
    filters.assignees.length ||
    filters.states.length ||
    filters.conditions.length
  )
}
export function pending(node: Node) {
  return node.type !== "completed" && node.type !== "canceled"
}
export function matchesCondition(
  node: Node,
  condition: Condition,
  graph: Graph
) {
  if (node.isEpic || !pending(node)) return false
  const blocked = (graph.preds[node.id] ?? []).some((id) => {
    const blocker = graph.nodesById[id]
    return blocker && pending(blocker)
  })
  switch (condition) {
    case "blocked":
      return blocked
    case "ready":
      return !blocked && (node.type === "unstarted" || node.type === "backlog")
    case "unestimated":
      return node.pts === null
    case "unassigned":
      return node.assigneeId === null
  }
}
export function matchesFilters(node: Node, filters: Filters, graph: Graph) {
  return (
    (!filters.assignees.length ||
      filters.assignees.includes(node.assigneeId ?? "unassigned")) &&
    (!filters.states.length || filters.states.includes(node.stateId ?? "")) &&
    filters.conditions.every((condition) =>
      matchesCondition(node, condition, graph)
    )
  )
}
export function actionGroups(nodes: Node[], graph: Graph) {
  return Object.fromEntries(
    Object.keys(CONDITIONS).map((condition) => [
      condition,
      nodes
        .filter(
          (node) =>
            node.inCycle &&
            matchesCondition(node, condition as Condition, graph)
        )
        .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })),
    ])
  ) as Record<Condition, Node[]>
}
const unique = (values: string[]) =>
  [...new Set(values.filter((v) => v.length > 0 && v.length < 150))].slice(
    0,
    100
  )
export function decodeView(params: URLSearchParams): ViewState {
  const selected = params.get("issue")
  return {
    filters: {
      assignees: unique(params.getAll("assignee")),
      states: unique(params.getAll("state")),
      conditions: unique(params.getAll("condition")).filter(
        (v): v is Condition => Object.hasOwn(CONDITIONS, v)
      ),
    },
    active: unique(params.getAll("show")).filter((v): v is Visibility =>
      [
        "showOutside",
        "showParents",
        "hideParents",
        "showOrphans",
        "hideOrphans",
      ].includes(v)
    ),
    selected:
      selected && /^[A-Za-z][A-Za-z0-9_]*-\d+$/.test(selected)
        ? selected
        : null,
    cycle: params.get("cycle")?.slice(0, 150) || null,
  }
}
export function encodeView(view: ViewState, params = new URLSearchParams()) {
  for (const key of [
    "assignee",
    "state",
    "condition",
    "show",
    "issue",
    "cycle",
  ])
    params.delete(key)
  for (const id of unique(view.filters.assignees).sort())
    params.append("assignee", id)
  for (const id of unique(view.filters.states).sort())
    params.append("state", id)
  for (const condition of [...view.filters.conditions].sort())
    params.append("condition", condition)
  for (const key of [...view.active].sort()) params.append("show", key)
  if (view.selected) params.set("issue", view.selected)
  if (view.cycle) params.set("cycle", view.cycle)
  return params
}
