import { PlanningWorkspace } from "@/components/planning/planning-workspace"
import { requireTeam } from "@/lib/workspaces/access"
export default async function StagePage({
  params,
}: {
  params: Promise<{ id: string; workspaceId: string; teamId: string }>
}) {
  const { id, workspaceId, teamId } = await params
  const team = await requireTeam(teamId, workspaceId)
  return <PlanningWorkspace stageId={id} workspaceSlug={team.workspaceSlug} />
}
