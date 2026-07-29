"use client"

import { RotateCcwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export type ToggleKey = "showOutside" | "showParents" | "showOrphans"

export function ToggleBar({
  active,
  onToggle,
  onReset,
}: {
  active: ToggleKey[]
  onToggle: (keys: ToggleKey[]) => void
  onReset: () => void
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
        <ToggleGroupItem value="showOutside">Fuera del ciclo</ToggleGroupItem>
        <ToggleGroupItem value="showParents">Padre / hijo</ToggleGroupItem>
        <ToggleGroupItem value="showOrphans">Sin dependencias</ToggleGroupItem>
      </ToggleGroup>
      <Button variant="outline" size="sm" onClick={onReset}>
        <RotateCcwIcon data-icon="inline-start" />
        Reencuadrar
      </Button>
      <span className="ml-auto hidden text-xs text-muted-foreground md:inline">
        clic para aislar una cadena · arrastrar para mover · ⌘/ctrl + scroll
        para zoom
      </span>
    </div>
  )
}
