import "server-only"
import {
  calculateVelocity,
  type Velocity,
  type VelocityCycle,
} from "@/lib/planning/forecast"
import { mapConcurrent } from "@/lib/planning/concurrency"

import {
  CYCLE_GRAPH_QUERY,
  ISSUE_SEARCH_QUERY,
  ISSUE_DETAIL_QUERY,
  ISSUE_UPDATE_MUTATION,
  TEAM_ID_QUERY,
} from "@/lib/linear/query"
import {
  fromLinearResponse,
  fromSearchResponse,
  fromIssueDetailResponse,
} from "@/lib/linear/normalize"
import type { IssueDetail, SearchIssue, Snapshot } from "@/lib/schema/snapshot"

import type { IssueUpdateInput, IssueValues } from "@/lib/schema/issue-update"
export type { IssueUpdateInput } from "@/lib/schema/issue-update"

/**
 * Boundary between "how we read Linear" and everything downstream.
 * Today it's a personal API key read server-side. If this ever moves to
 * Linear OAuth (preplan §2.2, the natural upgrade path), only this file
 * and its implementation change — nothing that consumes a Snapshot does.
 */
export interface LinearSource {
  getVelocity(): Promise<Velocity>
  createDependency(
    id: string,
    blockerId: string,
    blockedId: string
  ): Promise<void>
  deleteDependency(id: string): Promise<void>
  getPlanningCycles(): Promise<import("@/lib/planning/types").PlanningCycle[]>
  getActiveCycleSnapshot(): Promise<Snapshot>
  getIssueDetail(id: string, cycleId: string): Promise<IssueDetail>
  getIssueValues(id: string): Promise<IssueValues>
  updateIssue(id: string, input: IssueUpdateInput): Promise<void>
  searchIssues(term: string): Promise<SearchIssue[]>
}

const LINEAR_GRAPHQL_ENDPOINT = "https://api.linear.app/graphql"

// Each caller narrows this to its own response shape (see lib/linear/normalize.ts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GraphQLJson = any

class LinearApiKeySource implements LinearSource {
  private teamId: string | null = null

  constructor(
    private readonly apiKey: string,
    private readonly teamKey: string,
    private readonly workspace: string
  ) {}

  private async request(
    query: string,
    variables: Record<string, unknown>
  ): Promise<GraphQLJson> {
    const res = await fetch(LINEAR_GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Linear expects the raw key here, no "Bearer" prefix.
        Authorization: this.apiKey,
      },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    })

    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `La API key de Linear fue rechazada (HTTP ${res.status}).`
      )
    }

    const json = await res.json()
    if (json.errors?.length)
      throw new Error(
        json.errors.map((e: { message: string }) => e.message).join(" · ")
      )
    if (!res.ok) throw new Error(`Linear no respondió (HTTP ${res.status}).`)
    return json
  }

  async getActiveCycleSnapshot(): Promise<Snapshot> {
    const json = await this.request(CYCLE_GRAPH_QUERY, {
      teamKey: this.teamKey,
    })
    const active = json.data?.teams?.nodes?.[0]?.activeCycle
    if (active) {
      let page = active.issues
      while (page.pageInfo?.hasNextPage) {
        const next = await this.request(CYCLE_GRAPH_QUERY, {
          teamKey: this.teamKey,
          after: page.pageInfo.endCursor,
        })
        page = next.data.teams.nodes[0].activeCycle.issues
        active.issues.nodes.push(...page.nodes)
      }
    }
    const snapshot = fromLinearResponse(json, this.workspace)
    // Fetch full epic context and only the issue relations truncated by the compact cycle query.
    const extraIds = new Set<string>(
      snapshot.nodes.filter((node) => node.isEpic).map((node) => node.id)
    )
    for (const issue of active.issues.nodes) {
      if (
        [issue.children, issue.relations, issue.inverseRelations].some(
          (connection) => connection?.pageInfo?.hasNextPage
        )
      )
        extraIds.add(issue.identifier)
    }
    const details = await mapConcurrent([...extraIds], (id) =>
      this.getIssueDetail(id, snapshot.cycle.id)
    )
    const nodes = new Map(snapshot.nodes.map((node) => [node.id, node]))
    const blocks = new Map(
      snapshot.blocks.map((edge) => [edge.join("|"), edge])
    )
    for (const detail of details) {
      detail.nodes.forEach((node) => nodes.set(node.id, node))
      detail.blocks.forEach((edge) => blocks.set(edge.join("|"), edge))
    }
    return {
      ...snapshot,
      nodes: [...nodes.values()],
      blocks: [...blocks.values()],
    }
  }

  async getIssueDetail(id: string, cycleId: string): Promise<IssueDetail> {
    const json = await this.request(ISSUE_DETAIL_QUERY, { id })
    const issue = json.data?.issue
    if (!issue) throw new Error("No se encontró la issue.")
    for (const [field, cursor] of [
      ["children", "childrenAfter"],
      ["relations", "relationsAfter"],
      ["inverseRelations", "inverseAfter"],
    ]) {
      let page = issue[field]
      while (page.pageInfo?.hasNextPage) {
        const next = await this.request(ISSUE_DETAIL_QUERY, {
          id,
          [cursor]: page.pageInfo.endCursor,
        })
        page = next.data.issue[field]
        issue[field].nodes.push(...page.nodes)
      }
    }
    return fromIssueDetailResponse(json, cycleId)
  }

  async getPlanningCycles(): Promise<
    import("@/lib/planning/types").PlanningCycle[]
  > {
    const teamId = await this.resolveTeamId()
    const json = await this.request(
      `query PlanningCycles($id: String!) {
      team(id: $id) {
        activeCycle { id name number startsAt endsAt }
        cycles(first: 50) { nodes { id name number startsAt endsAt } pageInfo { hasNextPage endCursor } }
      }
    }`,
      { id: teamId }
    )
    const team = json.data.team
    const cycles = [...team.cycles.nodes]
    let page = team.cycles
    while (page.pageInfo.hasNextPage) {
      const next = await this.request(
        `query MoreCycles($id: String!, $after: String!) {
        team(id: $id) { cycles(first: 50, after: $after) { nodes { id name number startsAt endsAt } pageInfo { hasNextPage endCursor } } }
      }`,
        { id: teamId, after: page.pageInfo.endCursor }
      )
      page = next.data.team.cycles
      cycles.push(...page.nodes)
    }
    const active = team.activeCycle
    const next = cycles
      .filter(
        (c) =>
          new Date(c.startsAt).getTime() >
          (active ? new Date(active.startsAt).getTime() : Date.now())
      )
      .sort(
        (a, b) =>
          new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
      )[0]
    return [
      active && { ...active, kind: "current" },
      next && { ...next, kind: "next" },
    ]
      .filter(Boolean)
      .map((c) => ({ ...c, name: c.name ?? `Ciclo ${c.number}` }))
  }

  async getVelocity(): Promise<Velocity> {
    const teamId = await this.resolveTeamId()
    const cycles: VelocityCycle[] = []
    let after: string | null = null
    do {
      const json = await this.request(
        `query VelocityCycles($id: String!, $after: String) {
        team(id: $id) { cycles(first: 50, after: $after) {
          nodes { id name number startsAt endsAt completedAt completedScopeHistory }
          pageInfo { hasNextPage endCursor }
        } }
      }`,
        { id: teamId, after }
      )
      const page = json.data.team.cycles
      cycles.push(
        ...page.nodes.map((cycle: VelocityCycle & { number: number }) => ({
          ...cycle,
          name: cycle.name ?? `Ciclo ${cycle.number}`,
        }))
      )
      after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null
    } while (after)
    return calculateVelocity(cycles)
  }

  async createDependency(
    id: string,
    blockerId: string,
    blockedId: string
  ): Promise<void> {
    const json = await this.request(
      `mutation CreateBlockingRelation($input: IssueRelationCreateInput!) {
      issueRelationCreate(input: $input) { success }
    }`,
      {
        input: {
          id,
          issueId: blockerId,
          relatedIssueId: blockedId,
          type: "blocks",
        },
      }
    )
    if (!json.data?.issueRelationCreate?.success)
      throw new Error("Linear no confirmó el bloqueo.")
  }

  async deleteDependency(id: string): Promise<void> {
    const json = await this.request(
      `mutation DeleteBlockingRelation($id: String!) {
      issueRelationDelete(id: $id) { success }
    }`,
      { id }
    )
    if (!json.data?.issueRelationDelete?.success)
      throw new Error("Linear no confirmó la eliminación del bloqueo.")
  }

  async getIssueValues(id: string): Promise<IssueValues> {
    const json = await this.request(
      `query IssueValues($id: String!) {
      issue(id: $id) { assignee { id } state { id } cycle { id } estimate }
    }`,
      { id }
    )
    if (json.errors?.length)
      throw new Error(
        json.errors
          .map((error: { message: string }) => error.message)
          .join(" · ")
      )
    const issue = json.data?.issue
    if (!issue?.state?.id)
      throw new Error("No se pudo leer el estado actual de la issue.")
    return {
      assigneeId: issue.assignee?.id ?? null,
      stateId: issue.state.id,
      cycleId: issue.cycle?.id ?? null,
      estimate: issue.estimate ?? null,
    }
  }

  async updateIssue(id: string, input: IssueUpdateInput): Promise<void> {
    if (input.cycleId !== undefined || input.estimate !== undefined) {
      const check = await this.request(
        `query IssueKind($id: String!) { issue(id: $id) { children(first: 1) { nodes { id } } } }`,
        { id }
      )
      if (!check.data?.issue) throw new Error("No se encontró la issue.")
      if (check.data.issue.children.nodes.length)
        throw new Error(
          "Las épicas no se estiman ni se agregan a ciclos. Elegí sus subissues."
        )
    }
    const json = await this.request(ISSUE_UPDATE_MUTATION, { id, input })
    if (json.errors?.length) {
      throw new Error(
        (json.errors as { message: string }[]).map((e) => e.message).join(" · ")
      )
    }
    if (!json.data?.issueUpdate?.success) {
      throw new Error("Linear no confirmó el cambio.")
    }
  }

  private async resolveTeamId(): Promise<string> {
    if (this.teamId) return this.teamId

    const json = await this.request(TEAM_ID_QUERY, { teamKey: this.teamKey })
    const id = json.data?.teams?.nodes?.[0]?.id
    if (!id) throw new Error("No encontré el equipo para buscar issues.")

    this.teamId = id
    return id
  }

  async searchIssues(term: string): Promise<SearchIssue[]> {
    const teamId = await this.resolveTeamId()
    const json = await this.request(ISSUE_SEARCH_QUERY, { term, teamId })
    return fromSearchResponse(json)
  }
}

let cached: LinearSource | null = null

export function getLinearSource(): LinearSource {
  if (cached) return cached

  const apiKey = process.env.LINEAR_API_KEY
  const teamKey = process.env.LINEAR_TEAM_KEY
  if (!apiKey)
    throw new Error("Falta LINEAR_API_KEY en el entorno del servidor.")
  if (!teamKey)
    throw new Error("Falta LINEAR_TEAM_KEY en el entorno del servidor.")

  cached = new LinearApiKeySource(apiKey, teamKey, "movosend")
  return cached
}
