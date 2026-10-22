import type { Metadata } from "next"
import { TeamIssuesView } from "@/components/issues/team-issues-view"
import { requireTeam } from "@/lib/workspaces/access"

export const metadata: Metadata = { title: "Todos los issues" }

export default async function IssuesPage({
  params,
}: {
  params: Promise<{ workspaceId: string; teamId: string }>
}) {
  const { workspaceId, teamId } = await params
  await requireTeam(teamId, workspaceId)
  return <TeamIssuesView />
}
