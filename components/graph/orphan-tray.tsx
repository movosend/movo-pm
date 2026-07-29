import type { Node } from "@/lib/schema/snapshot"
import { statusColorVar } from "@/components/graph/status-color"

export function OrphanTray({
  orphans,
  onSelect,
}: {
  orphans: Node[]
  onSelect: (id: string) => void
}) {
  if (orphans.length === 0) return null

  return (
    <div className="max-h-32 overflow-y-auto border-t bg-muted/40 px-4 py-2.5">
      <div className="mb-2 text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">
        Sin dependencias declaradas · {orphans.length} issues
      </div>
      <div className="flex flex-wrap gap-1.5">
        {orphans.map((n) => (
          <button
            key={n.id}
            type="button"
            onClick={() => onSelect(n.id)}
            className="flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 text-xs hover:border-ring"
          >
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{ background: statusColorVar(n) }}
            />
            <span>{n.short}</span>
            <span className="text-muted-foreground">
              {n.who ?? "sin asignar"}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
