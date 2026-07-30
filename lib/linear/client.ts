import "server-only"

import {
  CYCLE_GRAPH_QUERY,
  ISSUE_SEARCH_QUERY,
  ISSUE_UPDATE_MUTATION,
  TEAM_ID_QUERY,
} from "@/lib/linear/query"
import { fromLinearResponse, fromSearchResponse } from "@/lib/linear/normalize"
import type { SearchIssue, Snapshot } from "@/lib/schema/snapshot"

export type IssueUpdateInput = {
  assigneeId?: string | null
  stateId?: string
  cycleId?: string
  estimate?: number | null
}

/**
 * Boundary between "how we read Linear" and everything downstream.
 * Today it's a personal API key read server-side. If this ever moves to
 * Linear OAuth (preplan §2.2, the natural upgrade path), only this file
 * and its implementation change — nothing that consumes a Snapshot does.
 */
export interface LinearSource {
  getActiveCycleSnapshot(): Promise<Snapshot>
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
    })

    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `La API key de Linear fue rechazada (HTTP ${res.status}).`
      )
    }

    return res.json()
  }

  async getActiveCycleSnapshot(): Promise<Snapshot> {
    const json = await this.request(CYCLE_GRAPH_QUERY, {
      teamKey: this.teamKey,
    })
    return fromLinearResponse(json, this.workspace)
  }

  async updateIssue(id: string, input: IssueUpdateInput): Promise<void> {
    const json = await this.request(ISSUE_UPDATE_MUTATION, { id, input })
    if (json.errors?.length) {
      throw new Error(
        (json.errors as { message: string }[])
          .map((e) => e.message)
          .join(" · ")
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
