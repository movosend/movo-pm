import "server-only"

import { CYCLE_GRAPH_QUERY } from "@/lib/linear/query"
import { fromLinearResponse } from "@/lib/linear/normalize"
import type { Snapshot } from "@/lib/schema/snapshot"

/**
 * Boundary between "how we read Linear" and everything downstream.
 * Today it's a personal API key read server-side. If this ever moves to
 * Linear OAuth (preplan §2.2, the natural upgrade path), only this file
 * and its implementation change — nothing that consumes a Snapshot does.
 */
export interface LinearSource {
  getActiveCycleSnapshot(): Promise<Snapshot>
}

const LINEAR_GRAPHQL_ENDPOINT = "https://api.linear.app/graphql"

class LinearApiKeySource implements LinearSource {
  constructor(
    private readonly apiKey: string,
    private readonly teamKey: string,
    private readonly workspace: string
  ) {}

  async getActiveCycleSnapshot(): Promise<Snapshot> {
    const res = await fetch(LINEAR_GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Linear expects the raw key here, no "Bearer" prefix.
        Authorization: this.apiKey,
      },
      body: JSON.stringify({
        query: CYCLE_GRAPH_QUERY,
        variables: { teamKey: this.teamKey },
      }),
      cache: "no-store",
    })

    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `La API key de Linear fue rechazada (HTTP ${res.status}).`
      )
    }

    const json = await res.json()
    return fromLinearResponse(json, this.workspace)
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
