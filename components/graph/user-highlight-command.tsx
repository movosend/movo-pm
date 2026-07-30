"use client"

import { UserRoundXIcon, UsersIcon } from "lucide-react"

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import type { TeamMember } from "@/lib/schema/snapshot"

export function UserHighlightCommand({
  open,
  onOpenChange,
  members,
  highlightedUserId,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  members: TeamMember[]
  highlightedUserId: string | null
  onSelect: (userId: string | null) => void
}) {
  function choose(userId: string | null) {
    onSelect(userId)
    onOpenChange(false)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Resaltar por usuario"
      description="Elegí un integrante para resaltar sus issues en el grafo."
    >
      <Command>
        <CommandInput placeholder="Buscar integrante…" />
        <CommandList>
          <CommandEmpty>Sin resultados.</CommandEmpty>
          {highlightedUserId && (
            <CommandGroup>
              <CommandItem
                value="__clear__"
                onSelect={() => choose(null)}
                className="flex items-center gap-2.5"
              >
                <UserRoundXIcon className="size-3.5 text-muted-foreground" />
                Quitar resaltado
              </CommandItem>
            </CommandGroup>
          )}
          <CommandGroup>
            {members.map((member) => (
              <CommandItem
                key={member.id}
                value={member.name}
                onSelect={() => choose(member.id)}
                data-checked={member.id === highlightedUserId}
                className="flex items-center gap-2.5"
              >
                <UsersIcon className="size-3.5 text-muted-foreground" />
                {member.name}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
