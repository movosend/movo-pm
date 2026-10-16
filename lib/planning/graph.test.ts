import { describe, expect, it } from "vitest"
import { normalDag } from "@/lib/graph/__fixtures__"
import { planningGraph } from "./graph"
import { buildGraph } from "@/lib/graph/build"
import { actionGroups } from "@/lib/graph/view-state"

describe("planning exploration", () => {
  it("shows only direct ghosts, expanding the frontier when one is incorporated", () => {
    const snapshot = {
      ...normalDag,
      nodes: normalDag.nodes.map((n) => ({ ...n, type: "unstarted" as const })),
    }
    expect(
      planningGraph(snapshot, new Set(["A"]), false).nodes.map((n) => n.id)
    ).toEqual(["A", "B"])
    expect(
      planningGraph(snapshot, new Set(["A", "B"]), false).nodes.map((n) => n.id)
    ).toEqual(["A", "B", "C"])
  })
  it("includes both directions and preserves included resolved work", () => {
    expect(
      planningGraph(normalDag, new Set(["B"]), false).nodes.map((n) => n.id)
    ).toEqual(["B", "C"])
    expect(
      planningGraph(normalDag, new Set(["B"]), true).nodes.map((n) => n.id)
    ).toEqual(["A", "B", "C"])
    expect(
      planningGraph(normalDag, new Set(["A"]), false).nodes.map((n) => n.id)
    ).toEqual(["A", "B"])
  })
  it("deduplicates shared edges and keeps isolated work selectable", () => {
    const result = planningGraph(
      { ...normalDag, blocks: [...normalDag.blocks, ["B", "C"]] },
      new Set(["B", "D"]),
      true
    )
    expect(result.blocks).toHaveLength(2)
    expect(result.nodes.some((n) => n.id === "D")).toBe(true)
  })
  it("never treats epics as work or unestimated tasks", () => {
    const epic = {
      ...normalDag.nodes[0],
      id: "EPIC",
      type: "backlog" as const,
      pts: null,
      isEpic: true,
    }
    const snapshot = {
      ...normalDag,
      nodes: [...normalDag.nodes, epic],
      blocks: [...normalDag.blocks, ["EPIC", "B"] as [string, string]],
    }
    expect(
      planningGraph(snapshot, new Set(["B", "EPIC"]), true).nodes.some(
        (n) => n.isEpic
      )
    ).toBe(false)
    const graph = buildGraph(snapshot)
    expect(graph.nodesById.EPIC).toBeUndefined()
    expect(
      actionGroups(snapshot.nodes, graph).unestimated.some(
        (n) => n.id === "EPIC"
      )
    ).toBe(false)
    expect(buildGraph(snapshot, true).preds.B).toContain("EPIC")
  })
})
