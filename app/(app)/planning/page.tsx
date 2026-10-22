import { redirect } from "next/navigation"
import { listAccessibleTeams } from "@/lib/workspaces/access"
import { workspacePath } from "@/lib/workspaces/routes"

export default async function LegacyPlanningPage() {
  const first = (await listAccessibleTeams()).flatMap((item) =>
    item.teams.map((team) => ({ workspaceId: item.workspace.id, teamId: team.id }))
  )[0]
  redirect(first ? workspacePath(first.workspaceId, first.teamId, "/planning") : "/")
}
