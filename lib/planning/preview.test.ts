import { describe, expect, it } from "vitest"
import { normalDag } from "@/lib/graph/__fixtures__"
import { buildStagePreview } from "./preview"
import { planningLayout, PLANNING_CARD } from "./layout"
import { planningGraph } from "./graph"

describe("stage previews", () => {
  it("matches the canvas layout and keeps isolated included issues", () => {
    const included = ["B", "D"]
    const graph = planningGraph(normalDag, new Set(included), false)
    const expected = planningLayout(graph)
    const preview = buildStagePreview(included, [normalDag])
    expect(preview.count).toBe(2)
    expect(preview.nodes.map((n) => n.id)).toEqual(graph.nodes.map((n) => n.id))
    for (const node of preview.nodes) {
      expect({ x: node.x, y: node.y }).toEqual(expected.pos[node.id])
      expect(node.x + PLANNING_CARD.nodeWidth).toBeLessThan(preview.width)
      expect(node.y + PLANNING_CARD.nodeHeight).toBeLessThan(preview.height)
      expect(node.included).toBe(included.includes(node.id))
    }
    expect(preview.nodes.find((n) => n.id === "D")).toBeDefined()
    expect(preview.edges[0].suggested).toBe(true)
  })
  it("deduplicates relations and does not expose issue descriptions", () => {
    const preview = buildStagePreview(["B", "C"], [normalDag, normalDag])
    expect(preview.edges).toHaveLength(1)
    expect(preview.edges[0].suggested).toBe(false)
    expect(preview.nodes[0]).not.toHaveProperty("description")
  })
  it("represents an empty sheet without a fabricated graph", () => {
    const preview = buildStagePreview([], [])
    expect(preview.count).toBe(0)
    expect(preview.nodes).toEqual([])
    expect(preview.edges).toEqual([])
    expect(preview.width).toBeGreaterThan(0)
    expect(preview.height).toBeGreaterThan(0)
  })
})
