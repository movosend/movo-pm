import "server-only"

import { AsyncLocalStorage } from "node:async_hooks"

export type TeamContext = {
  id: string
  workspaceId: string
  key: string
  workspaceSlug: string
  connectionStatus: string
}

const storage = new AsyncLocalStorage<TeamContext>()

export function withTeamContext<T>(team: TeamContext, work: () => T): T {
  return storage.run(team, work)
}

export function currentTeam(): TeamContext | undefined {
  return storage.getStore()
}
