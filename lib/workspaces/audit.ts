import "server-only"

import { db } from "@/lib/db/client"
import { linearAudit } from "@/lib/db/schema"
import { currentTeam } from "./context"

export async function auditLinearWrite(
  actorEmail: string,
  action: string,
  targetId: string
) {
  const team = currentTeam()
  if (!team) return
  try {
    await db
      .insert(linearAudit)
      .values({
        workspaceId: team.workspaceId,
        teamId: team.id,
        actorEmail,
        action,
        targetId,
      })
  } catch (error) {
    console.error("Could not record Linear write audit", error)
  }
}
