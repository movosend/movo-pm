"use client"

import { RotateCcwIcon, SearchIcon, UsersIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { SyncButton } from "@/components/graph/sync-button"

export type ToggleKey = "showOutside" | "showParents" | "showOrphans"

export function ToggleBar({
  active,
  onToggle,
  onReset,
  onOpenSearch,
  onOpenUserPalette,
  highlightedUserName,
  onClearHighlight,
}: {
  active: ToggleKey[]
  onToggle: (keys: ToggleKey[]) => void
  onReset: () => void
  onOpenSearch: () => void
  onOpenUserPalette: () => void
  highlightedUserName?: string | null
  onClearHighlight: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
      <ToggleGroup
        multiple
        variant="outline"
        size="sm"
        value={active}
        onValueChange={(value) => onToggle(value as ToggleKey[])}
      >
        <ToggleGroupItem value="showOutside">
          Fuera del ciclo
          <Kbd>1</Kbd>
        </ToggleGroupItem>
        <ToggleGroupItem value="showParents">
          Padre / hijo
          <Kbd>2</Kbd>
        </ToggleGroupItem>
        <ToggleGroupItem value="showOrphans">
          Sin dependencias
          <Kbd>3</Kbd>
        </ToggleGroupItem>
      </ToggleGroup>
      <Button variant="outline" size="sm" onClick={onReset}>
        <RotateCcwIcon data-icon="inline-start" />
        Reencuadrar
        <Kbd>R</Kbd>
      </Button>
      <div className="ml-auto flex items-center gap-3">
        {highlightedUserName ? (
          <Button variant="outline" size="sm" onClick={onClearHighlight}>
            <XIcon data-icon="inline-start" />
            {highlightedUserName}
            <Kbd>Esc</Kbd>
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={onOpenUserPalette}>
            <UsersIcon data-icon="inline-start" />
            Resaltar por usuario
            <Kbd>U</Kbd>
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={onOpenSearch}>
          <SearchIcon data-icon="inline-start" />
          Agregar issue
          <KbdGroup>
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </KbdGroup>
        </Button>
        <SyncButton compact />
      </div>
    </div>
  )
}
