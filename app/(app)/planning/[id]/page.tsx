import { eq } from "drizzle-orm"
import { notFound, redirect } from "next/navigation"
import { db } from "@/lib/db/client"
import { linearTeams, planningStages } from "@/lib/db/schema"
import { requireTeam } from "@/lib/workspaces/access"
import { workspacePath } from "@/lib/workspaces/routes"

export default async function LegacyStagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [stage] = await db.select({ teamId: planningStages.teamId, workspaceId: linearTeams.workspaceId })
    .from(planningStages).innerJoin(linearTeams, eq(planningStages.teamId, linearTeams.id))
    .where(eq(planningStages.id, id)).limit(1)
  if (!stage?.teamId) notFound()
  try { await requireTeam(stage.teamId, stage.workspaceId) } catch { notFound() }
  redirect(workspacePath(stage.workspaceId, stage.teamId, `/planning/${id}`))
}
