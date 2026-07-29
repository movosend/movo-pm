import type { Node, Snapshot } from "@/lib/schema/snapshot"

function node(overrides: Partial<Node> & { id: string }): Node {
  return {
    short: overrides.id,
    title: overrides.id,
    status: "Todo",
    type: "unstarted",
    pts: 1,
    who: null,
    parent: null,
    inCycle: true,
    description: null,
    assigneeId: null,
    stateId: null,
    ...overrides,
  }
}

function snapshot(nodes: Node[], blocks: Array<[string, string]>): Snapshot {
  return {
    cycle: {
      id: "cycle-test",
      number: 1,
      team: "Movo Team",
      name: "Cycle Test",
      start: "1 ene",
      end: "14 ene",
      taken: "1 ene 2026",
      live: false,
      workspace: "movosend",
    },
    analysis: null,
    nodes,
    blocks,
    states: [],
    members: [],
  }
}

/** A -> B -> C, D standalone (no relations). */
export const normalDag: Snapshot = snapshot(
  [
    node({ id: "A", type: "completed" }),
    node({ id: "B", type: "started" }),
    node({ id: "C", type: "unstarted" }),
    node({ id: "D" }),
  ],
  [
    ["A", "B"],
    ["B", "C"],
  ]
)

/** A -> B -> C -> A: Linear allows creating this even though it's invalid. */
export const cyclicGraph: Snapshot = snapshot(
  [node({ id: "A" }), node({ id: "B" }), node({ id: "C" })],
  [
    ["A", "B"],
    ["B", "C"],
    ["C", "A"],
  ]
)

export const emptyGraph: Snapshot = snapshot([], [])

/** A single node with no declared relations at all — the "huérfano" case. */
export const isolatedNode: Snapshot = snapshot([node({ id: "SOLO" })], [])

/**
 * Parent P is in the cycle; two of its three children are, one (C3) was
 * left in the backlog — the "sub-issue varada" case from the glossary.
 */
export const parentWithChildrenOutside: Snapshot = snapshot(
  [
    node({ id: "P", pts: null }),
    node({ id: "C1", parent: "P" }),
    node({ id: "C2", parent: "P" }),
    node({ id: "C3", parent: "P", inCycle: false, type: "backlog" }),
  ],
  []
)

/** A -> B -> C on the critical path, B has no estimate (parent US pattern). */
export const nullEstimatesOnCriticalPath: Snapshot = snapshot(
  [
    node({ id: "A", type: "completed" }),
    node({ id: "B", pts: null, type: "started" }),
    node({ id: "C", type: "unstarted" }),
  ],
  [
    ["A", "B"],
    ["B", "C"],
  ]
)

/**
 * X blocks Y, but X belongs to another team and was never fetched by the
 * CycleGraph query — the edge exists in `blocks` but not in `nodes`.
 */
export const relationToOtherTeamIssue: Snapshot = snapshot(
  [node({ id: "Y" })],
  [["OTHERTEAM-1", "Y"]]
)
