import { describe, expect, it } from "vitest"

import { buildGraph } from "@/lib/graph/build"
import { topoLevels } from "@/lib/graph/levels"
import { cyclicGraph, emptyGraph, normalDag } from "@/lib/graph/__fixtures__"

describe("topoLevels", () => {
  it("assigns level 0 to unblocked nodes and increments downstream", () => {
    const levels = topoLevels(buildGraph(normalDag))
    expect(levels.A).toBe(0)
    expect(levels.B).toBe(1)
    expect(levels.C).toBe(2)
    expect(levels.D).toBe(0)
  })

  it("returns an empty map for an empty graph", () => {
    expect(topoLevels(buildGraph(emptyGraph))).toEqual({})
  })

  it("resolves a cyclic graph without hanging", { timeout: 200 }, () => {
    const levels = topoLevels(buildGraph(cyclicGraph))
    expect(Object.keys(levels)).toEqual(expect.arrayContaining(["A", "B", "C"]))
  })
})
