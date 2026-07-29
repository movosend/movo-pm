import { describe, expect, it } from "vitest"

import { buildGraph } from "@/lib/graph/build"
import {
  emptyGraph,
  isolatedNode,
  normalDag,
  relationToOtherTeamIssue,
} from "@/lib/graph/__fixtures__"

describe("buildGraph", () => {
  it("builds preds/succs maps from blocks", () => {
    const graph = buildGraph(normalDag)
    expect(graph.succs.A).toEqual(["B"])
    expect(graph.preds.B).toEqual(["A"])
    expect(graph.preds.D).toEqual([])
  })

  it("marks a node with no relations as orphan only if it's in the cycle", () => {
    const graph = buildGraph(isolatedNode)
    expect(graph.orphans).toEqual(["SOLO"])
  })

  it("handles an empty snapshot without throwing", () => {
    const graph = buildGraph(emptyGraph)
    expect(graph.orphans).toEqual([])
    expect(Object.keys(graph.nodesById)).toEqual([])
  })

  it("drops edges pointing at an issue outside the snapshot (another team)", () => {
    const graph = buildGraph(relationToOtherTeamIssue)
    expect(graph.preds.Y).toEqual([])
    expect(graph.nodesById["OTHERTEAM-1"]).toBeUndefined()
  })
})
