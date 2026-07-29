import { FreshnessIndicator } from "@/components/graph/freshness-indicator"
import type { Cycle, Node } from "@/lib/schema/snapshot"

export function CycleHeader({
  cycle,
  nodes,
}: {
  cycle: Cycle
  nodes: Node[]
}) {
  const inCycle = nodes.filter((n) => n.inCycle)
  const done = inCycle.filter((n) => n.type === "completed")
  const pts = inCycle.reduce((sum, n) => sum + (n.pts ?? 0), 0)
  const donePts = done.reduce((sum, n) => sum + (n.pts ?? 0), 0)

  return (
    <header className="flex flex-wrap items-baseline gap-7 border-b px-6 py-4">
      <div>
        <div className="text-xl leading-tight font-semibold tracking-tight">
          {cycle.team} · {cycle.name}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          {cycle.start} → {cycle.end} ·{" "}
          <FreshnessIndicator taken={cycle.taken} live={cycle.live} />
        </div>
      </div>
      <div className="ml-auto flex flex-wrap gap-7">
        <Stat label="cerradas" value={`${done.length}/${inCycle.length}`} />
        <Stat label="puntos" value={`${donePts}/${pts}`} />
      </div>
    </header>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xl leading-tight font-semibold tracking-tight">
        {value}
      </div>
      <div className="text-[10.5px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </div>
    </div>
  )
}
