import { describe, expect, it } from "vitest"

import { diff } from "@/lib/graph/diff"
import { normalDag } from "@/lib/graph/__fixtures__"

describe("diff", () => {
  it("marks an open block as resolved once its blocker completes", () => {
    const next = {
      ...normalDag,
      nodes: normalDag.nodes.map((n) =>
        n.id === "B" ? { ...n, type: "completed" as const } : n
      ),
    }
    const result = diff(normalDag, next)
    expect(result.resolved).toEqual([["B", "C"]])
    expect(result.new).toEqual([])
  })

  it("marks a survived block as worsened when the blocker didn't move", () => {
    const result = diff(normalDag, normalDag)
    expect(result.unchanged).toEqual([["B", "C"]])
    expect(result.worsened).toEqual([["B", "C"]])
  })

  it("marks a new edge as new, not unchanged", () => {
    const next = {
      ...normalDag,
      blocks: [...normalDag.blocks, ["D", "C"] as [string, string]],
    }
    const result = diff(normalDag, next)
    expect(result.new).toEqual([["D", "C"]])
  })
})
