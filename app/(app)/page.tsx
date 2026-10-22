import Link from "next/link"
import { redirect } from "next/navigation"
import { listAccessibleTeams, isAdmin } from "@/lib/workspaces/access"
import { workspacePath } from "@/lib/workspaces/routes"
import { auth } from "@/auth"

export default async function HomePage() {
  const workspaces = await listAccessibleTeams()
  const first = workspaces.flatMap((item) => item.teams.map((team) => ({ workspaceId: item.workspace.id, teamId: team.id })))[0]
  if (first) redirect(workspacePath(first.workspaceId, first.teamId))
  const admin = isAdmin((await auth())?.user?.id)
  return <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
    <h1 className="text-lg font-semibold">Todavía no hay equipos disponibles</h1>
    <p className="text-sm text-muted-foreground">{admin ? "Conectá un workspace y habilitá un equipo." : "Un administrador debe invitarte y habilitar un equipo."}</p>
    {admin && <Link href="/settings/workspaces" className="text-sm underline">Administrar workspaces</Link>}
  </div>
}
