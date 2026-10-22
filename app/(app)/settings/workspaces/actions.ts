"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db/client"
import {
  linearTeams,
  linearWorkspaces,
  workspaceMembers,
} from "@/lib/db/schema"
import { requireAdmin } from "@/lib/workspaces/access"

export async function setTeamEnabled(formData: FormData) {
  await requireAdmin()
  const teamId = String(formData.get("teamId") ?? "")
  const enabled = formData.get("enabled") === "true"
  await db
    .update(linearTeams)
    .set({ enabled })
    .where(eq(linearTeams.id, teamId))
  revalidatePath("/settings/workspaces")
}

export async function inviteWorkspaceMember(formData: FormData) {
  await requireAdmin()
  const workspaceId = String(formData.get("workspaceId") ?? "")
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    throw new Error("Correo inválido.")
  const [workspace] = await db
    .select({ id: linearWorkspaces.id })
    .from(linearWorkspaces)
    .where(eq(linearWorkspaces.id, workspaceId))
    .limit(1)
  if (!workspace) throw new Error("Workspace no disponible.")
  await db
    .insert(workspaceMembers)
    .values({ workspaceId, email })
    .onConflictDoNothing()
  revalidatePath("/settings/workspaces")
}

export async function removeWorkspaceMember(formData: FormData) {
  await requireAdmin()
  const workspaceId = String(formData.get("workspaceId") ?? "")
  const email = String(formData.get("email") ?? "").toLowerCase()
  await db
    .delete(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.email, email)
      )
    )
  revalidatePath("/settings/workspaces")
}
