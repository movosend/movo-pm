"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDownIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { workspacePath } from "@/lib/workspaces/routes"

type WorkspaceOption = {
  workspace: {
    id: string
    name: string
    slug: string
    connectionStatus: string
  }
  teams: { id: string; key: string; name: string }[]
}

export function WorkspaceSwitcher({
  workspaces,
}: {
  workspaces: WorkspaceOption[]
}) {
  const pathname = usePathname()
  const current = workspaces
    .flatMap((item) =>
      item.teams.map((team) => ({ workspace: item.workspace, team }))
    )
    .find((item) =>
      pathname.startsWith(workspacePath(item.workspace.id, item.team.id))
    )
  if (!workspaces.some((item) => item.teams.length)) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        <span className="max-w-36 truncate">
          {current
            ? `${current.workspace.name} · ${current.team.key}`
            : "Elegir equipo"}
        </span>
        <ChevronDownIcon data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {workspaces
          .filter((item) => item.teams.length)
          .map((item) => (
            <div key={item.workspace.id}>
              <DropdownMenuLabel>{item.workspace.name}</DropdownMenuLabel>
              {item.teams.map((team) => (
                <DropdownMenuItem
                  key={team.id}
                  render={
                    <Link href={workspacePath(item.workspace.id, team.id)} />
                  }
                  nativeButton={false}
                >
                  {team.name} ({team.key})
                </DropdownMenuItem>
              ))}
            </div>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
