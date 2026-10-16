import { afterEach, describe, expect, it, vi } from "vitest"
import { fromIssueDetailResponse } from "./normalize"

vi.mock("server-only", () => ({}))
const issue = (id: string, epic = false) => ({
  id: `uuid-${id}`,
  identifier: id,
  title: id,
  description: "Description",
  estimate: null,
  url: "https://linear.app/example",
  childCheck: { nodes: epic ? [{ id: "child" }] : [] },
  state: { id: "todo", name: "Todo", type: "unstarted" },
  assignee: null,
  parent: null,
  cycle: null,
})
const connection = <T>(
  nodes: T[],
  hasNextPage = false,
  endCursor: string | null = null
) => ({ nodes, pageInfo: { hasNextPage, endCursor } })
const detail = () => ({
  ...issue("MOVO-1", true),
  children: connection([issue("MOVO-2")]),
  relations: connection([{ type: "blocks", relatedIssue: issue("MOVO-3") }]),
  inverseRelations: connection([]),
  team: { states: { nodes: [] }, members: { nodes: [] } },
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe("Linear planning data", () => {
  it("classifies by child existence, preserves stable IDs and cycle assignment", () => {
    const root = {
      ...detail(),
      cycle: { id: "next", name: "Next cycle", number: 5 },
    }
    const result = fromIssueDetailResponse({ data: { issue: root } }, "current")
    expect(result.nodes[0]).toMatchObject({
      uuid: "uuid-MOVO-1",
      isEpic: true,
      cycleId: "next",
      cycleName: "Next cycle",
      inCycle: false,
    })
    expect(result.nodes.find((n) => n.id === "MOVO-2")?.isEpic).toBe(false)
    expect(result.blocks).toEqual([["MOVO-1", "MOVO-3"]])
  })
  it("paginates children and both relation directions without losing earlier pages", async () => {
    vi.stubEnv("LINEAR_API_KEY", "test")
    vi.stubEnv("LINEAR_TEAM_KEY", "MOVO")
    const fetcher = vi.fn(async (_url: string, init: RequestInit) => {
      const { variables } = JSON.parse(init.body as string)
      const root = detail()
      root.children = variables.childrenAfter
        ? connection([issue("MOVO-4")])
        : connection([issue("MOVO-2")], true, "children-1")
      root.relations = variables.relationsAfter
        ? connection([{ type: "blocks", relatedIssue: issue("MOVO-5") }])
        : connection(
            [{ type: "blocks", relatedIssue: issue("MOVO-3") }],
            true,
            "relations-1"
          )
      const inverse = variables.inverseAfter
        ? connection([{ type: "blocks", issue: issue("MOVO-7") }])
        : connection(
            [{ type: "blocks", issue: issue("MOVO-6") }],
            true,
            "inverse-1"
          )
      return Response.json({
        data: { issue: { ...root, inverseRelations: inverse } },
      })
    })
    vi.stubGlobal("fetch", fetcher)
    const { getLinearSource } = await import("./client")
    const result = await getLinearSource().getIssueDetail("MOVO-1", "current")
    expect(fetcher).toHaveBeenCalledTimes(4)
    expect(result.nodes.map((n) => n.id).sort()).toEqual([
      "MOVO-1",
      "MOVO-2",
      "MOVO-3",
      "MOVO-4",
      "MOVO-5",
      "MOVO-6",
      "MOVO-7",
    ])
    expect(result.blocks).toContainEqual(["MOVO-7", "MOVO-1"])
  })
  it("rejects cycle and estimate writes to an epic before sending a mutation", async () => {
    vi.stubEnv("LINEAR_API_KEY", "test")
    vi.stubEnv("LINEAR_TEAM_KEY", "MOVO")
    const fetcher = vi.fn(async () =>
      Response.json({
        data: { issue: { children: { nodes: [{ id: "child" }] } } },
      })
    )
    vi.stubGlobal("fetch", fetcher)
    const { getLinearSource } = await import("./client")
    await expect(
      getLinearSource().updateIssue("MOVO-1", { cycleId: "next" })
    ).rejects.toThrow("épicas")
    await expect(
      getLinearSource().updateIssue("MOVO-1", { estimate: 3 })
    ).rejects.toThrow("épicas")
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(
      fetcher.mock.calls.every(
        (call) => !JSON.stringify(call).includes("mutation")
      )
    ).toBe(true)
  })
  it("does not return an apparently complete detail when a later page fails", async () => {
    vi.stubEnv("LINEAR_API_KEY", "test")
    vi.stubEnv("LINEAR_TEAM_KEY", "MOVO")
    const root = detail()
    root.children = connection(root.children.nodes, true, "more")
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ data: { issue: root } }))
        .mockResolvedValueOnce(
          Response.json(
            { errors: [{ message: "Rate limited" }] },
            { status: 429 }
          )
        )
    )
    const { getLinearSource } = await import("./client")
    await expect(
      getLinearSource().getIssueDetail("MOVO-1", "current")
    ).rejects.toThrow("Rate limited")
  })
})
