import { describe, expect, it } from "vitest"

import { buildGraph } from "@/lib/graph/build"
import { detectCycles } from "@/lib/graph/cycles"
import { cyclicGraph, normalDag } from "@/lib/graph/__fixtures__"

describe("detectCycles", () => {
  it("returns no cycles for a DAG", () => {
    expect(detectCycles(buildGraph(normalDag))).toEqual([])
  })

  it("finds the cycle and returns the involved identifiers", () => {
    const cycles = detectCycles(buildGraph(cyclicGraph))
    expect(cycles).toHaveLength(1)
    expect(cycles[0]).toEqual(expect.arrayContaining(["A", "B", "C"]))
  })

  it(
    "terminates on a cyclic graph instead of hanging",
    { timeout: 200 },
    () => {
      expect(() => detectCycles(buildGraph(cyclicGraph))).not.toThrow()
    }
  )
})
