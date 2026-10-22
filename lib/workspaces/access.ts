import "server-only"

import { and, eq, inArray } from "drizzle-orm"
import { auth } from "@/auth"
import { db } from "@/lib/db/client"
import {
  linearTeams,
  linearWorkspaces,
  workspaceMembers,
} from "@/lib/db/schema"
import { withTeamContext, type TeamContext } from "./context"

export const LEGACY_WORKSPACE_ID = "00000000-0000-4000-8000-000000000001"
export const LEGACY_TEAM_ID = "00000000-0000-4000-8000-000000000002"

export function isAdmin(githubId?: string | null): boolean {
  return Boolean(
    githubId &&
    (process.env.ADMIN_GITHUB_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .includes(githubId)
  )
}

export async function requireAdmin() {
  const session = await auth()
  if (!isAdmin(session?.user?.id))
    throw new Error("Acceso de administrador requerido.")
  return session!
}

export async function listAccessibleTeams() {
  const session = await auth()
  const email = session?.user?.email?.toLowerCase()
  if (!email) return []
  const admin = isAdmin(session?.user?.id)
  const memberRows = admin
    ? []
    : await db
        .select({ workspaceId: workspaceMembers.workspaceId })
        .from(workspaceMembers)
        .where(eq(workspaceMembers.email, email))
  if (!admin && !memberRows.length) return []
  const workspaces = await db.select().from(linearWorkspaces)
  const allowedIds = new Set(memberRows.map((row) => row.workspaceId))
  const visible = workspaces.filter((row) => admin || allowedIds.has(row.id))
  if (!visible.length) return []
  const teams = await db
    .select()
    .from(linearTeams)
    .where(
      inArray(
        linearTeams.workspaceId,
        visible.map((row) => row.id)
      )
    )
  return visible.map((workspace) => ({
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      connectionStatus: workspace.connectionStatus,
    },
    teams: teams
      .filter((team) => team.workspaceId === workspace.id && team.enabled)
      .map((team) => ({ id: team.id, key: team.key, name: team.name })),
  }))
}

export async function requireTeam(
  teamId: string,
  workspaceId?: string
): Promise<TeamContext> {
  const session = await auth()
  const email = session?.user?.email?.toLowerCase()
  if (!email) throw new Error("Iniciá sesión para continuar.")
  const [row] = await db
    .select({
      id: linearTeams.id,
      key: linearTeams.key,
      enabled: linearTeams.enabled,
      workspaceId: linearWorkspaces.id,
      workspaceSlug: linearWorkspaces.slug,
      connectionStatus: linearWorkspaces.connectionStatus,
    })
    .from(linearTeams)
    .innerJoin(
      linearWorkspaces,
      eq(linearTeams.workspaceId, linearWorkspaces.id)
    )
    .where(eq(linearTeams.id, teamId))
    .limit(1)
  if (!row?.enabled || (workspaceId && row.workspaceId !== workspaceId))
    throw new Error("Equipo no disponible.")
  if (!isAdmin(session?.user?.id)) {
    const [membership] = await db
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, row.workspaceId),
          eq(workspaceMembers.email, email)
        )
      )
      .limit(1)
    if (!membership) throw new Error("No tenés acceso a este workspace.")
  }
  return {
    id: row.id,
    key: row.key,
    workspaceId: row.workspaceId,
    workspaceSlug: row.workspaceSlug,
    connectionStatus: row.connectionStatus,
  }
}

export async function inTeam<T>(
  teamId: string,
  work: () => T,
  workspaceId?: string
): Promise<Awaited<T>> {
  const team = await requireTeam(teamId, workspaceId)
  return await withTeamContext(team, work)
}
