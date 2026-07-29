import { FreshnessIndicator } from "@/components/graph/freshness-indicator"
import type { Cycle, Node } from "@/lib/schema/snapshot"

export function CycleHeader({
  cycle,
  nodes,
  openBlocksCount,
  chainLength,
}: {
  cycle: Cycle
  nodes: Node[]
  openBlocksCount: number
  chainLength: number
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
        <Stat
          label="bloqueos abiertos"
          value={String(openBlocksCount)}
          emphasis
        />
        <Stat label="cadena más larga" value={String(chainLength)} />
      </div>
    </header>
  )
}

function Stat({
  label,
  value,
  emphasis,
}: {
  label: string
  value: string
  emphasis?: boolean
}) {
  return (
    <div>
      <div
        className="text-xl leading-tight font-semibold tracking-tight"
        style={emphasis ? { color: "var(--status-stop)" } : undefined}
      >
        {value}
      </div>
      <div className="text-[10.5px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </div>
    </div>
  )
}
