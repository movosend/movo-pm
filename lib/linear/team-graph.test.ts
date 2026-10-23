import { expect, it } from "vitest"
import { buildGraph } from "@/lib/graph/build"
import { layoutGraph } from "@/lib/graph/layout"
import { fromTeamGraphPage } from "@/lib/linear/normalize"

it("connects blockers across all team issues, including ones outside the active cycle", () => {
  const issue = (identifier: string) => ({
    id: identifier,
    identifier,
    title: identifier,
    url: `https://linear.app/test/issue/${identifier}`,
    estimate: null,
    state: { id: "state", name: "Por hacer", type: "unstarted" },
    assignee: null,
    parent: null,
    cycle: null,
    childCheck: { nodes: [] as { id: string }[] },
    relations: {
      nodes: [] as { type: string; relatedIssue: { identifier: string } }[],
    },
    inverseRelations: {
      nodes: [] as { type: string; issue: { identifier: string } }[],
    },
  })
  const a = issue("TEAM-1")
  const b = issue("TEAM-2")
  const epic = issue("TEAM-3")
  epic.childCheck.nodes.push({ id: "child" })
  a.relations.nodes.push({
    type: "blocks",
    relatedIssue: { identifier: b.identifier },
  })
  b.inverseRelations.nodes.push({
    type: "blocks",
    issue: { identifier: a.identifier },
  })
  b.relations.nodes.push({
    type: "related",
    relatedIssue: { identifier: a.identifier },
  })

  const page = fromTeamGraphPage(
    {
      data: {
        teams: {
          nodes: [
            {
              name: "Team",
              activeCycle: null,
              states: { nodes: [] },
              members: { nodes: [] },
              issues: {
                nodes: [a, b, epic],
                pageInfo: { hasNextPage: false, endCursor: null },
              },
            },
          ],
        },
      },
    },
    "test"
  )
  const graph = buildGraph({
    cycle: page.cycle,
    nodes: page.nodes,
    blocks: page.blocks,
    states: page.states,
    members: page.members,
    analysis: null,
  })
  expect(page.nodes.every((node) => node.inCycle)).toBe(true)
  expect(page.blocks).toEqual([["TEAM-1", "TEAM-2"]])
  expect(graph.succs["TEAM-1"]).toEqual(["TEAM-2"])
  expect(graph.preds["TEAM-2"]).toEqual(["TEAM-1"])
  expect(
    layoutGraph(
      {
        cycle: page.cycle,
        nodes: page.nodes,
        blocks: page.blocks,
        states: page.states,
        members: page.members,
        analysis: null,
      },
      { showOutside: false, includeEpics: true }
    ).orphans
  ).toContain("TEAM-3")
})
