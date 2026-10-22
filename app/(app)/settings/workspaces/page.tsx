import Link from "next/link"
import { PlusIcon, UserPlusIcon } from "lucide-react"

import { auth } from "@/auth"
import { WorkspaceAvatar } from "@/components/workspace-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { db } from "@/lib/db/client"
import {
  linearTeams,
  linearWorkspaces,
  workspaceMembers,
} from "@/lib/db/schema"
import { isAdmin } from "@/lib/workspaces/access"

import {
  inviteWorkspaceMember,
  setTeamEnabled,
  updateWorkspaceMember,
} from "./actions"

type Workspace = typeof linearWorkspaces.$inferSelect

function WorkspaceChoices({
  workspaces,
  selectedIds,
  prefix,
}: {
  workspaces: Workspace[]
  selectedIds: Set<string>
  prefix: string
}) {
  return (
    <FieldSet>
      <FieldLegend variant="label">Workspaces permitidos</FieldLegend>
      <div className="grid gap-3 sm:grid-cols-2">
        {workspaces.map((workspace) => {
          const id = `${prefix}-${workspace.id}`
          return (
            <Field key={workspace.id} orientation="horizontal">
              <Checkbox
                id={id}
                name="workspaceId"
                value={workspace.id}
                defaultChecked={selectedIds.has(workspace.id)}
              />
              <FieldLabel htmlFor={id} className="flex items-center gap-2">
                <WorkspaceAvatar
                  name={workspace.name}
                  logoUrl={workspace.logoUrl}
                  small
                />
                {workspace.name}
              </FieldLabel>
            </Field>
          )
        })}
      </div>
    </FieldSet>
  )
}

export default async function WorkspacesSettingsPage() {
  if (!isAdmin((await auth())?.user?.id)) return null

  const [workspaces, teams, memberships] = await Promise.all([
    db.select().from(linearWorkspaces),
    db.select().from(linearTeams),
    db.select().from(workspaceMembers),
  ])
  const members = [...new Set(memberships.map((member) => member.email))].sort()

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-5 py-8 sm:px-8">
        <header className="flex flex-wrap items-end justify-between gap-5">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">Configuración</p>
            <h1 className="text-2xl font-semibold tracking-tight">
              Workspaces y accesos
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Conectá Linear, elegí los equipos disponibles y asigná cada
              persona a los workspaces que puede ver.
            </p>
          </div>
          <Button
            render={<Link href="/api/linear/connect" />}
            nativeButton={false}
          >
            <PlusIcon data-icon="inline-start" />
            Conectar workspace
          </Button>
        </header>

        <section
          className="flex flex-col gap-4"
          aria-labelledby="workspaces-title"
        >
          <div className="flex items-center gap-3">
            <h2 id="workspaces-title" className="text-lg font-semibold">
              Workspaces
            </h2>
            <Badge variant="secondary">{workspaces.length}</Badge>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {workspaces.map((workspace) => {
              const workspaceTeams = teams.filter(
                (team) => team.workspaceId === workspace.id
              )
              return (
                <Card key={workspace.id}>
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <WorkspaceAvatar
                        name={workspace.name}
                        logoUrl={workspace.logoUrl}
                      />
                      <div className="min-w-0 flex-1">
                        <CardTitle>{workspace.name}</CardTitle>
                        <CardDescription>{workspace.slug}</CardDescription>
                      </div>
                      <Badge variant="outline">
                        {workspace.connectionStatus === "connected"
                          ? "OAuth activo"
                          : workspace.connectionStatus === "legacy"
                            ? "API key"
                            : "Reconectar"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      EQUIPOS DISPONIBLES
                    </p>
                    {workspaceTeams.map((team) => (
                      <form
                        key={team.id}
                        action={setTeamEnabled}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="min-w-0 truncate text-sm">
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
                    {!workspaceTeams.length && (
                      <p className="text-sm text-muted-foreground">
                        Todavía no hay equipos disponibles.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>

        <section className="flex flex-col gap-4" aria-labelledby="people-title">
          <div className="flex items-center gap-3">
            <h2 id="people-title" className="text-lg font-semibold">
              Personas
            </h2>
            <Badge variant="secondary">{members.length}</Badge>
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:items-start">
            <Card>
              <CardHeader>
                <CardTitle>Invitar persona</CardTitle>
                <CardDescription>
                  Usá el correo principal verificado de su cuenta de GitHub.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  action={inviteWorkspaceMember}
                  className="flex flex-col gap-5"
                >
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="invite-email">
                        Correo de GitHub
                      </FieldLabel>
                      <Input
                        id="invite-email"
                        type="email"
                        name="email"
                        placeholder="persona@empresa.com"
                        required
                      />
                    </Field>
                    <WorkspaceChoices
                      workspaces={workspaces}
                      selectedIds={
                        new Set(
                          workspaces.length === 1 ? [workspaces[0].id] : []
                        )
                      }
                      prefix="invite"
                    />
                  </FieldGroup>
                  <Button type="submit" disabled={!workspaces.length}>
                    <UserPlusIcon data-icon="inline-start" />
                    Invitar persona
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Acceso actual</CardTitle>
                <CardDescription>
                  Marcá los workspaces de cada persona y guardá. Para quitarle
                  todo el acceso, desmarcá todos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {members.length ? (
                  <div className="flex flex-col">
                    {members.map((email, index) => (
                      <div key={email}>
                        {index > 0 && <Separator className="my-5" />}
                        <form
                          action={updateWorkspaceMember}
                          className="flex flex-col gap-4"
                        >
                          <input type="hidden" name="email" value={email} />
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="min-w-0 text-sm font-medium break-all">
                              {email}
                            </p>
                            <Button type="submit" size="sm" variant="outline">
                              Guardar cambios
                            </Button>
                          </div>
                          <WorkspaceChoices
                            workspaces={workspaces}
                            selectedIds={
                              new Set(
                                memberships
                                  .filter((member) => member.email === email)
                                  .map((member) => member.workspaceId)
                              )
                            }
                            prefix={`member-${index}`}
                          />
                        </form>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Todavía no hay personas invitadas.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  )
}
