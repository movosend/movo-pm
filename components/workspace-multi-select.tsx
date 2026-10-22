"use client"

import { ChevronDownIcon } from "lucide-react"

import { WorkspaceAvatar } from "@/components/workspace-avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type WorkspaceChoice = {
  id: string
  name: string
  logoUrl: string | null
}

export function WorkspaceMultiSelect({
  id,
  workspaces,
  selectedIds,
  onToggle,
  busy = false,
}: {
  id?: string
  workspaces: WorkspaceChoice[]
  selectedIds: string[]
  onToggle: (workspaceId: string, checked: boolean) => void
  busy?: boolean
}) {
  const selected = workspaces.filter((workspace) =>
    selectedIds.includes(workspace.id)
  )
  const label =
    selected.length === 0
      ? "Elegir workspaces"
      : selected.length === 1
        ? selected[0].name
        : `${selected.length} workspaces`

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            className="max-w-full justify-between"
          />
        }
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected.length === 1 && (
            <WorkspaceAvatar
              name={selected[0].name}
              logoUrl={selected[0].logoUrl}
              small
            />
          )}
          <span className="truncate">{label}</span>
        </span>
        <ChevronDownIcon data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Workspaces permitidos</DropdownMenuLabel>
          {workspaces.map((workspace) => (
            <DropdownMenuCheckboxItem
              key={workspace.id}
              checked={selectedIds.includes(workspace.id)}
              disabled={busy}
              onCheckedChange={(checked) => onToggle(workspace.id, checked)}
            >
              <WorkspaceAvatar
                name={workspace.name}
                logoUrl={workspace.logoUrl}
                small
              />
              {workspace.name}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
