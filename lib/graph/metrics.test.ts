import { describe, expect, it } from "vitest"

import { buildGraph } from "@/lib/graph/build"
import {
  bottlenecks,
  criticalPathLoad,
  longestChain,
  openBlocks,
  strandedChildren,
} from "@/lib/graph/metrics"
import {
  normalDag,
  nullEstimatesOnCriticalPath,
  parentWithChildrenOutside,
} from "@/lib/graph/__fixtures__"

describe("openBlocks", () => {
  it("only includes edges whose blocker hasn't completed", () => {
    const graph = buildGraph(normalDag)
    // A is completed, so A->B is not an open block; B->C is (B is "started").
    expect(openBlocks(graph)).toEqual([["B", "C"]])
  })
})

describe("bottlenecks", () => {
  it("ranks open blockers by how much downstream work they hold", () => {
    const graph = buildGraph(normalDag)
    const result = bottlenecks(graph)
    expect(result.map((b) => b.id)).toEqual(["B"])
    expect(result[0].downstreamCount).toBe(1)
  })
})

describe("longestChain", () => {
  it("finds the longest path through the DAG", () => {
    const graph = buildGraph(normalDag)
    expect(longestChain(graph)).toEqual(["A", "B", "C"])
  })

  it("doesn't crash when a node on the chain has no estimate", () => {
    const graph = buildGraph(nullEstimatesOnCriticalPath)
    expect(longestChain(graph)).toEqual(["A", "B", "C"])
  })
})

describe("strandedChildren", () => {
  it("summarizes epic context without requiring the epic itself in the cycle", () => {
    const result = strandedChildren(parentWithChildrenOutside.nodes)
    expect(result).toEqual([{ parent: "P", total: 3, outside: ["C3"] }])
  })
})

describe("criticalPathLoad", () => {
  it("propagates null estimates as null, never coercing to 0", () => {
    const node = nullEstimatesOnCriticalPath.nodes.find((n) => n.id === "B")
    expect(node?.pts).toBeNull()
  })

  it("counts open fronts for each person on the critical chain", () => {
    const nodes = [
      ...normalDag.nodes.map((n) =>
        n.id === "B" ? { ...n, who: "Alena" } : n
      ),
      {
        ...normalDag.nodes[0],
        id: "E",
        who: "Alena",
        type: "started" as const,
      },
    ]
    const load = criticalPathLoad(["A", "B", "C"], nodes)
    expect(load).toEqual([{ who: "Alena", issuesOnPath: 1, openIssues: 2 }])
  })
})
