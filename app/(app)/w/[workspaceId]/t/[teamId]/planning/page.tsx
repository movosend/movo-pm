import { StageList } from "@/components/planning/stage-list"
import { requireTeam } from "@/lib/workspaces/access"
export default async function PlanningPage({
  params,
}: {
  params: Promise<{ workspaceId: string; teamId: string }>
}) {
  const { workspaceId, teamId } = await params
  await requireTeam(teamId, workspaceId)
  return <StageList />
}
