import { describe, expect, it } from "vitest"
import { buildGraph } from "@/lib/graph/build"
import { normalDag } from "@/lib/graph/__fixtures__"
import {
  actionGroups,
  decodeView,
  emptyFilters,
  encodeView,
  matchesCondition,
  matchesFilters,
} from "@/lib/graph/view-state"
import { layoutGraph } from "@/lib/graph/layout"
import type { Node } from "@/lib/schema/snapshot"

const node = (id: string, overrides: Partial<Node> = {}): Node => ({
  ...normalDag.nodes[0],
  id,
  type: "unstarted",
  pts: null,
  stateId: "todo",
  assigneeId: "ana",
  ...overrides,
})
const nodes = [
  node("MOVO-10"),
  node("MOVO-2", { assigneeId: "bob", pts: 0 }),
  node("MOVO-3", { type: "completed", assigneeId: null }),
  node("MOVO-4", { type: "canceled", assigneeId: null }),
  node("MOVO-5", { assigneeId: null }),
  node("MOVO-6", { inCycle: false }),
  node("MOVO-7", { type: "started", stateId: "doing" }),
]
const snapshot = {
  ...normalDag,
  nodes,
  blocks: [
    ["MOVO-6", "MOVO-10"],
    ["MOVO-4", "MOVO-2"],
    ["MOVO-3", "MOVO-2"],
    ["MOVO-6", "MOVO-5"],
  ] as [string, string][],
}
const graph = buildGraph(snapshot)
describe("cycle filters", () => {
  it("combines OR within categories and AND across categories and conditions", () => {
    const filters = {
      ...emptyFilters(),
      assignees: ["ana", "bob"],
      states: ["todo"],
      conditions: ["ready"] as const,
    }
    expect(
      nodes
        .filter((n) =>
          matchesFilters(
            n,
            { ...filters, conditions: [...filters.conditions] },
            graph
          )
        )
        .map((n) => n.id)
    ).toEqual(["MOVO-2", "MOVO-6"])
    expect(
      matchesFilters(
        nodes[0],
        { ...emptyFilters(), conditions: ["blocked", "unestimated"] },
        graph
      )
    ).toBe(true)
    expect(
      matchesFilters(
        nodes[1],
        { ...emptyFilters(), conditions: ["blocked", "ready"] },
        graph
      )
    ).toBe(false)
    expect(
      matchesFilters(
        nodes[4],
        { ...emptyFilters(), assignees: ["unassigned"] },
        graph
      )
    ).toBe(true)
  })
  it("uses hidden external blockers and ignores resolved blockers", () => {
    expect(matchesCondition(nodes[0], "blocked", graph)).toBe(true)
    expect(matchesCondition(nodes[1], "ready", graph)).toBe(true)
    expect(matchesCondition(nodes[6], "ready", graph)).toBe(false)
  })
  it("treats zero as estimated and excludes resolved issues from action groups", () => {
    const groups = actionGroups(nodes, graph)
    expect(groups.blocked.map((n) => n.id)).toEqual(["MOVO-5", "MOVO-10"])
    expect(groups.unestimated.some((n) => n.pts === 0)).toBe(false)
    expect(groups.unassigned.map((n) => n.id)).toEqual(["MOVO-5"])
    expect(
      groups.unestimated.every(
        (n) => n.inCycle && n.type !== "completed" && n.type !== "canceled"
      )
    ).toBe(true)
  })
  it("does not change layout positions when filtering and includes external orphans when visible", () => {
    const layout = layoutGraph(snapshot, { showOutside: false })
    matchesFilters(
      nodes[0],
      { ...emptyFilters(), conditions: ["ready"] },
      graph
    )
    expect(layoutGraph(snapshot, { showOutside: false }).pos).toEqual(
      layout.pos
    )
    const isolated = {
      ...snapshot,
      nodes: [node("MOVO-8", { inCycle: false })],
      blocks: [],
    }
    expect(layoutGraph(isolated, { showOutside: false }).orphans).toEqual([])
    expect(layoutGraph(isolated, { showOutside: true }).orphans).toEqual([
      "MOVO-8",
    ])
  })
})
describe("shareable graph state", () => {
  it("round trips issue, cycle, multiple filters and visibility", () => {
    const state = {
      filters: {
        assignees: ["ana", "bob"],
        states: ["doing", "todo"],
        conditions: ["blocked", "unestimated"] as ("blocked" | "unestimated")[],
      },
      active: ["showOutside", "showOrphans"] as (
        "showOutside" | "showOrphans"
      )[],
      selected: "MOVO-123",
      cycle: "cycle-1",
    }
    const params = encodeView(
      state,
      new URLSearchParams("keep=yes&issue=OLD-1")
    )
    expect(decodeView(params)).toEqual({
      ...state,
      active: ["showOrphans", "showOutside"],
    })
    expect(params.get("keep")).toBe("yes")
  })
  it("ignores invalid conditions, deduplicates and validates issue codes", () => {
    const view = decodeView(
      new URLSearchParams(
        "condition=invalid&condition=ready&condition=ready&show=hack&issue=javascript:alert(1)&assignee=ana&assignee=ana"
      )
    )
    expect(view.filters.conditions).toEqual(["ready"])
    expect(view.filters.assignees).toEqual(["ana"])
    expect(view.active).toEqual([])
    expect(view.selected).toBeNull()
  })
})
