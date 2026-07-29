import { statusColorVar } from "@/components/graph/status-color"

const ENTRIES = [
  { type: "started", status: "In Progress", label: "In Progress" },
  { type: "started", status: "In Review", label: "In Review" },
  { type: "unstarted", status: "Todo", label: "Todo" },
  { type: "completed", status: "Done", label: "Done" },
  { type: "backlog", status: "Backlog", label: "Backlog" },
] as const

export function StatusLegend() {
  return (
    <div className="absolute bottom-3 left-3 flex flex-wrap gap-x-3 gap-y-1.5 rounded-lg border bg-card/90 px-3 py-2 text-[11.5px] text-muted-foreground shadow-sm backdrop-blur-sm">
      {ENTRIES.map(({ type, status, label }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span
            className="size-1.5 rounded-full"
            style={{ background: statusColorVar({ type, status }) }}
          />
          {label}
        </div>
      ))}
    </div>
  )
}
