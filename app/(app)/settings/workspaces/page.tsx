import Link from "next/link"
import { db } from "@/lib/db/client"
import {
  linearTeams,
  linearWorkspaces,
  workspaceMembers,
} from "@/lib/db/schema"
import { requireAdmin } from "@/lib/workspaces/access"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  inviteWorkspaceMember,
  removeWorkspaceMember,
  setTeamEnabled,
} from "./actions"

export default async function WorkspacesSettingsPage() {
  await requireAdmin()
  const workspaces = await db.select().from(linearWorkspaces)
  const teams = await db.select().from(linearTeams)
  const members = await db.select().from(workspaceMembers)
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 overflow-y-auto p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Workspaces de Linear</h1>
        <Button
          render={<Link href="/api/linear/connect" />}
          nativeButton={false}
        >
          Conectar workspace
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        La persona que autoriza Linear debe poder instalar la aplicación en el
        workspace. Los cambios hechos desde esta herramienta aparecerán como
        realizados por la aplicación.
      </p>
      {workspaces.map((workspace) => (
        <Card key={workspace.id}>
          <CardHeader>
            <CardTitle>{workspace.name}</CardTitle>
            <CardDescription>
              {workspace.slug} ·{" "}
              {workspace.connectionStatus === "connected"
                ? "Conectado"
                : workspace.connectionStatus === "legacy"
                  ? "Conexión anterior con API key"
                  : "Requiere conexión"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-medium">Equipos habilitados</h2>
              {teams
                .filter((team) => team.workspaceId === workspace.id)
                .map((team) => (
                  <form
                    key={team.id}
                    action={setTeamEnabled}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="text-sm">
                      {team.name} ({team.key})
                    </span>
                    <input type="hidden" name="teamId" value={team.id} />
                    <input
                      type="hidden"
                      name="enabled"
                      value={team.enabled ? "false" : "true"}
                    />
                    <Button type="submit" size="sm" variant="outline">
                      {team.enabled ? "Deshabilitar" : "Habilitar"}
                    </Button>
                  </form>
                ))}
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-medium">Personas invitadas</h2>
              <p className="text-xs text-muted-foreground">
                Al agregar un correo se habilita el acceso; compartí la URL de
                esta herramienta con esa persona.
              </p>
              <form
                action={inviteWorkspaceMember}
                className="flex items-end gap-2"
              >
                <input type="hidden" name="workspaceId" value={workspace.id} />
                <FieldGroup className="flex-1">
                  <Field>
                    <FieldLabel htmlFor={`email-${workspace.id}`}>
                      Correo principal verificado de GitHub
                    </FieldLabel>
                    <Input
                      id={`email-${workspace.id}`}
                      type="email"
                      name="email"
                      required
                    />
                  </Field>
                </FieldGroup>
                <Button type="submit" size="sm">
                  Invitar
                </Button>
              </form>
              {members
                .filter((member) => member.workspaceId === workspace.id)
                .map((member) => (
                  <form
                    key={member.email}
                    action={removeWorkspaceMember}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="truncate text-sm">{member.email}</span>
                    <input
                      type="hidden"
                      name="workspaceId"
                      value={workspace.id}
                    />
                    <input type="hidden" name="email" value={member.email} />
                    <Button type="submit" variant="outline" size="sm">
                      Quitar
                    </Button>
                  </form>
                ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
