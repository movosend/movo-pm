import type {
  IssueDetail,
  Node,
  SearchIssue,
  Snapshot,
} from "@/lib/schema/snapshot"

// Raw shapes as returned by the CycleGraph query (see lib/linear/query.ts).
// Mirrors the Core/Lite fragments — kept intentionally loose (no brand types)
// since this is the only place that ever sees the raw Linear response.
type LinearIssueLite = {
  id?: string
  childCheck?: { nodes: { id: string }[] }
  cycle?: { id: string; name?: string | null; number?: number } | null
  identifier: string
  title: string
  estimate: number | null
  url: string
  state: { id: string; name: string; type: string } | null
  assignee: { id: string; displayName: string } | null
  parent: { identifier: string; title?: string } | null
}

type LinearIssueCore = LinearIssueLite & {
  description?: string | null
  children?: { nodes: LinearIssueLite[] }
  relations?: { nodes: { type: string; relatedIssue: LinearIssueLite }[] }
  inverseRelations?: { nodes: { type: string; issue: LinearIssueLite }[] }
}

type LinearGraphQLResponse = {
  errors?: { message: string }[]
  data?: {
    teams?: {
      nodes: {
        key: string
        name: string
        states?: {
          nodes: { id: string; name: string; type: string; position: number }[]
        }
        members?: { nodes: { id: string; displayName: string }[] }
        activeCycle: {
          id: string
          name: string | null
          number: number
          startsAt: string
          endsAt: string
          issues: { nodes: LinearIssueCore[] }
        } | null
      }[]
    }
  }
}

/**
 * Ported verbatim from docs/mockup.html (shorten/initials/fromLinear,
 * ~lines 524-563) — the contract is already validated against real Linear
 * data, don't "improve" it without re-validating against the mockup.
 */
export function shorten(title: string | null | undefined): string {
  let s = String(title ?? "").trim()
  const m = s.match(/quiero\s+(?:que\s+)?(.+?)(?:,\s*para|\.|$)/i)
  if (m) s = m[1]
  s = s.replace(/^\[[^\]]+\]\s*/, "").replace(/^Como\s+[^,]+,\s*/i, "")
  s = s.charAt(0).toUpperCase() + s.slice(1)
  return s.length > 44 ? s.slice(0, 43) + "…" : s
}

export function initials(name: string | null | undefined): string | null {
  if (!name) return null
  const parts = name.trim().split(/\s+/)
  return parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0]
}

function toNode(
  issue: LinearIssueLite & { description?: string | null },
  inCycle: boolean
): Node {
  return {
    uuid: issue.id,
    isEpic: issue.childCheck ? issue.childCheck.nodes.length > 0 : undefined,
    id: issue.identifier,
    title: issue.title,
    short: shorten(issue.title),
    status: issue.state?.name ?? "?",
    type: (issue.state?.type as Node["type"]) ?? "backlog",
    pts: issue.estimate ?? null,
    who: initials(issue.assignee?.displayName),
    parent: issue.parent?.identifier ?? null,
    parentTitle: issue.parent?.title ?? null,
    cycleId: issue.cycle?.id ?? null,
    cycleName: issue.cycle
      ? (issue.cycle.name ?? `Ciclo ${issue.cycle.number}`)
      : null,
    inCycle,
    description: issue.description ?? null,
    assigneeId: issue.assignee?.id ?? null,
    stateId: issue.state?.id ?? null,
  }
}

export function fromLinearResponse(
  json: LinearGraphQLResponse,
  workspace: string
): Snapshot {
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join(" · "))
  }

  const team = json.data?.teams?.nodes?.[0]
  if (!team) {
    throw new Error(
      "No encontré ese equipo. Es el prefijo de las issues: MOVO-123 → MOVO."
    )
  }

  const cycle = team.activeCycle
  if (!cycle) {
    throw new Error(`${team.name} no tiene un ciclo activo en este momento.`)
  }

  const inCycleIds = new Set(cycle.issues.nodes.map((i) => i.identifier))
  const map = new Map<string, Node>()

  const add = (issue: LinearIssueLite | undefined, forceInCycle: boolean) => {
    if (!issue) return
    const existing = map.get(issue.identifier)
    if (existing) {
      if (forceInCycle) existing.inCycle = true
      return
    }
    map.set(issue.identifier, toNode(issue, forceInCycle))
  }

  cycle.issues.nodes.forEach((issue) => {
    add(issue, true)
    if (issue.parent && "state" in issue.parent)
      add(
        issue.parent as LinearIssueLite,
        inCycleIds.has(issue.parent.identifier)
      )
  })

  const blocks = new Set<string>()
  cycle.issues.nodes.forEach((issue) => {
    ;(issue.relations?.nodes ?? []).forEach((r) => {
      if (r.type !== "blocks") return
      add(r.relatedIssue, inCycleIds.has(r.relatedIssue.identifier))
      blocks.add(`${issue.identifier}|${r.relatedIssue.identifier}`)
    })
    ;(issue.inverseRelations?.nodes ?? []).forEach((r) => {
      if (r.type !== "blocks") return
      add(r.issue, inCycleIds.has(r.issue.identifier))
      blocks.add(`${r.issue.identifier}|${issue.identifier}`)
    })
    ;(issue.children?.nodes ?? []).forEach((child) =>
      add(child, inCycleIds.has(child.identifier))
    )
  })

  const fmt = (d: string | null) =>
    d
      ? new Date(d).toLocaleDateString("es-AR", {
          day: "numeric",
          month: "short",
        })
      : ""

  return {
    cycle: {
      id: cycle.id,
      number: cycle.number,
      team: team.name,
      name: cycle.name ?? `Cycle ${cycle.number}`,
      start: fmt(cycle.startsAt),
      end: fmt(cycle.endsAt),
      taken: new Date().toLocaleString("es-AR", {
        dateStyle: "short",
        timeStyle: "short",
      }),
      live: true,
      workspace,
    },
    analysis: null,
    nodes: [...map.values()],
    blocks: [...blocks].map((s) => s.split("|") as [string, string]),
    states: [...(team.states?.nodes ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((s) => ({ id: s.id, name: s.name, type: s.type as Node["type"] })),
    members: (team.members?.nodes ?? [])
      .map((m) => ({ id: m.id, name: m.displayName }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}

type LinearSearchIssue = {
  id?: string
  childCheck?: { nodes: { id: string }[] }
  identifier: string
  title: string
  estimate: number | null
  url: string
  state: { name: string; type: string } | null
  assignee: { displayName: string } | null
  cycle: { id: string } | null
}

type LinearSearchResponse = {
  errors?: { message: string }[]
  data?: { searchIssues?: { nodes: LinearSearchIssue[] } }
}

export function fromSearchResponse(json: LinearSearchResponse): SearchIssue[] {
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join(" · "))
  }

  return (json.data?.searchIssues?.nodes ?? []).map((issue) => ({
    id: issue.identifier,
    short: shorten(issue.title),
    uuid: issue.id,
    isEpic: issue.childCheck ? issue.childCheck.nodes.length > 0 : undefined,
    title: issue.title,
    status: issue.state?.name ?? "?",
    type: (issue.state?.type as Node["type"]) ?? "backlog",
    pts: issue.estimate ?? null,
    who: initials(issue.assignee?.displayName),
    url: issue.url,
    cycleId: issue.cycle?.id ?? null,
  }))
}

type DetailIssue = LinearIssueLite & {
  description?: string | null
  cycle?: { id: string } | null
}
type LinearDetailResponse = {
  errors?: { message: string }[]
  data?: {
    issue?:
      | (DetailIssue & {
          parent: DetailIssue | null
          children: { nodes: DetailIssue[] }
          relations: { nodes: { type: string; relatedIssue: DetailIssue }[] }
          inverseRelations: { nodes: { type: string; issue: DetailIssue }[] }
          team: {
            states: {
              nodes: {
                id: string
                name: string
                type: Node["type"]
                position: number
              }[]
            }
            members: { nodes: { id: string; displayName: string }[] }
          }
        })
      | null
  }
}

export function fromIssueDetailResponse(
  json: LinearDetailResponse,
  cycleId: string
): IssueDetail {
  if (json.errors?.length)
    throw new Error(json.errors.map((e) => e.message).join(" · "))
  const issue = json.data?.issue
  if (!issue) throw new Error("No se encontró la issue en Linear.")
  const nodes = new Map<string, Node>()
  const add = (item: DetailIssue) =>
    nodes.set(item.identifier, toNode(item, item.cycle?.id === cycleId))
  add(issue)
  if (issue.parent) add(issue.parent)
  issue.children.nodes.forEach(add)
  const blocks: IssueDetail["blocks"] = []
  for (const relation of issue.relations.nodes) {
    if (relation.type !== "blocks") continue
    add(relation.relatedIssue)
    blocks.push([issue.identifier, relation.relatedIssue.identifier])
  }
  for (const relation of issue.inverseRelations.nodes) {
    if (relation.type !== "blocks") continue
    add(relation.issue)
    blocks.push([relation.issue.identifier, issue.identifier])
  }
  return {
    nodes: [...nodes.values()],
    blocks,
    states: [...issue.team.states.nodes]
      .sort((a, b) => a.position - b.position)
      .map(({ id, name, type }) => ({ id, name, type })),
    members: issue.team.members.nodes
      .map(({ id, displayName }) => ({ id, name: displayName }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}
