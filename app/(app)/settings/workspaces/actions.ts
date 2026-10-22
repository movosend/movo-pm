"use server"

import { and, eq, notInArray } from "drizzle-orm"
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

async function memberAccessInput(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    throw new Error("Correo inválido.")
  const workspaceIds = [...new Set(formData.getAll("workspaceId").map(String))]
  const workspaces = await db
    .select({ id: linearWorkspaces.id })
    .from(linearWorkspaces)
  const available = new Set(workspaces.map((workspace) => workspace.id))
  if (workspaceIds.some((id) => !available.has(id)))
    throw new Error("Workspace no disponible.")
  return { email, workspaceIds }
}

export async function inviteWorkspaceMember(formData: FormData) {
  await requireAdmin()
  const { email, workspaceIds } = await memberAccessInput(formData)
  if (!workspaceIds.length) throw new Error("Seleccioná al menos un workspace.")
  await db
    .insert(workspaceMembers)
    .values(workspaceIds.map((workspaceId) => ({ workspaceId, email })))
    .onConflictDoNothing()
  revalidatePath("/settings/workspaces")
}

export async function updateWorkspaceMember(formData: FormData) {
  await requireAdmin()
  const { email, workspaceIds } = await memberAccessInput(formData)
  if (workspaceIds.length)
    await db
      .insert(workspaceMembers)
      .values(workspaceIds.map((workspaceId) => ({ workspaceId, email })))
      .onConflictDoNothing()
  await db
    .delete(workspaceMembers)
    .where(
      workspaceIds.length
        ? and(
            eq(workspaceMembers.email, email),
            notInArray(workspaceMembers.workspaceId, workspaceIds)
          )
        : eq(workspaceMembers.email, email)
    )
  revalidatePath("/settings/workspaces")
}
