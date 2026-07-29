"use client"

import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react"

import { AnalyzeButton } from "@/components/graph/analyze-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import type { Graph } from "@/lib/graph/build"
import { walk } from "@/lib/graph/metrics"
import type { Bottleneck, StrandedChildren } from "@/lib/graph/metrics"
import type { Analysis, Node } from "@/lib/schema/snapshot"
import { statusColorVar, statusTextVar } from "@/components/graph/status-color"

const SEVERITY_LABEL: Record<Analysis["decisions"][number]["sev"], string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
}

function Row({
  node,
  label,
  sub,
  extra,
  onSelect,
}: {
  node: Node
  label?: string
  sub: string
  extra?: React.ReactNode
  onSelect: (id: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(node.id)}
      className="-mx-2 flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-muted"
    >
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ background: statusColorVar(node) }}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs">{label ?? node.short}</span>
        <span className="block text-[11px] text-muted-foreground">{sub}</span>
      </span>
      {extra}
    </button>
  )
}

function Section({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-6">
      <div className="mb-2.5 border-b pb-1.5 text-[10.5px] font-semibold tracking-wide text-muted-foreground uppercase">
        {label}
      </div>
      {children}
    </div>
  )
}

export function SidePanel({
  selected,
  nodesById,
  graph,
  chain,
  bottlenecksList,
  stranded,
  openBlocksList,
  analysis,
  workspace,
  onSelect,
  onBack,
}: {
  selected: Node | null
  nodesById: Map<string, Node>
  graph: Graph
  chain: string[]
  bottlenecksList: Bottleneck[]
  stranded: StrandedChildren[]
  openBlocksList: Array<[string, string]>
  analysis: Analysis | null
  workspace: string
  onSelect: (id: string) => void
  onBack: () => void
}) {
  return (
    <ScrollArea className="h-full">
      <div className="p-5">
        {selected ? (
          <DetailView
            node={selected}
            nodesById={nodesById}
            graph={graph}
            workspace={workspace}
            onSelect={onSelect}
            onBack={onBack}
          />
        ) : (
          <SummaryView
            nodesById={nodesById}
            chain={chain}
            bottlenecksList={bottlenecksList}
            stranded={stranded}
            openBlocksList={openBlocksList}
            analysis={analysis}
            onSelect={onSelect}
          />
        )}
      </div>
    </ScrollArea>
  )
}

function DetailView({
  node,
  nodesById,
  graph,
  workspace,
  onSelect,
  onBack,
}: {
  node: Node
  nodesById: Map<string, Node>
  graph: Graph
  workspace: string
  onSelect: (id: string) => void
  onBack: () => void
}) {
  const preds = graph.preds[node.id] ?? []
  const downstream = [...walk(node.id, graph.succs)]

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="mb-3.5 -ml-2 text-muted-foreground"
        onClick={onBack}
      >
        <ArrowLeftIcon data-icon="inline-start" />
        Volver al resumen
      </Button>
      <div className="text-[11.5px] font-semibold text-muted-foreground">
        {node.id}
      </div>
      <div className="mb-3.5 text-[15px] leading-snug font-semibold tracking-tight">
        {node.title}
      </div>

      <dl className="flex flex-col text-[12.5px]">
        <div className="flex items-center justify-between gap-3 border-b py-1.5">
          <dt className="text-muted-foreground">Estado</dt>
          <dd
            className="text-xs font-semibold"
            style={{ color: statusTextVar(node) }}
          >
            {node.status}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 border-b py-1.5">
          <dt className="text-muted-foreground">Responsable</dt>
          <dd>{node.who ?? "sin asignar"}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 border-b py-1.5">
          <dt className="text-muted-foreground">Puntos</dt>
          <dd>{node.pts ?? "sin estimar"}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 border-b py-1.5">
          <dt className="text-muted-foreground">En el ciclo</dt>
          <dd>{node.inCycle ? "sí" : "no · backlog"}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 py-1.5">
          <dt className="text-muted-foreground">Linear</dt>
          <dd>
            <a
              href={`https://linear.app/${workspace}/issue/${node.id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              abrir
              <ExternalLinkIcon className="size-3" />
            </a>
          </dd>
        </div>
      </dl>

      <div className="mt-5">
        <Section label={`Bloqueado por · ${preds.length}`}>
          {preds.length ? (
            preds.map((id) => {
              const p = nodesById.get(id)
              if (!p) return null
              return (
                <Row
                  key={id}
                  node={p}
                  sub={`${id} · ${p.status}`}
                  extra={
                    p.type !== "completed" ? (
                      <span
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ background: "var(--status-stop)" }}
                      />
                    ) : undefined
                  }
                  onSelect={onSelect}
                />
              )
            })
          ) : (
            <p className="text-xs text-muted-foreground">
              Nada lo frena. Se puede tomar hoy.
            </p>
          )}
        </Section>

        <Section label={`Desbloquea · ${downstream.length} aguas abajo`}>
          {downstream.length ? (
            downstream.map((id) => {
              const d = nodesById.get(id)
              if (!d) return null
              return (
                <Row
                  key={id}
                  node={d}
                  sub={`${id} · ${d.pts ? `${d.pts} pt` : "sin estimar"}`}
                  extra={
                    (graph.succs[node.id] ?? []).includes(id) ? (
                      <span className="text-[11px] text-muted-foreground">
                        directo
                      </span>
                    ) : undefined
                  }
                  onSelect={onSelect}
                />
              )
            })
          ) : (
            <p className="text-xs text-muted-foreground">
              No hay nada esperando esta issue.
            </p>
          )}
        </Section>
      </div>
    </>
  )
}

function SummaryView({
  nodesById,
  chain,
  bottlenecksList,
  stranded,
  openBlocksList,
  analysis,
  onSelect,
}: {
  nodesById: Map<string, Node>
  chain: string[]
  bottlenecksList: Bottleneck[]
  stranded: StrandedChildren[]
  openBlocksList: Array<[string, string]>
  analysis: Analysis | null
  onSelect: (id: string) => void
}) {
  return (
    <>
      <AnalyzeButton hasAnalysis={Boolean(analysis)} />
      {analysis && analysis.decisions.length > 0 && (
        <Section label={`Decisiones a tomar · ${analysis.generated}`}>
          <div className="flex flex-col gap-2.5">
            {analysis.decisions.map((d, i) => (
              <div key={i} className="rounded-md border p-3">
                <Badge
                  variant={d.sev === "alta" ? "destructive" : "secondary"}
                  className="mb-1.5"
                >
                  {SEVERITY_LABEL[d.sev]}
                </Badge>
                <h4 className="mb-1 text-[12.5px] font-semibold">{d.title}</h4>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {d.body}
                </p>
                {d.issues.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {d.issues.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onSelect(id)}
                        className="rounded border px-1.5 py-0.5 text-[10.5px] font-semibold"
                      >
                        {id}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section label="Sub-issues fuera del ciclo">
        {stranded.length ? (
          stranded.map((s) => {
            const parent = nodesById.get(s.parent)
            if (!parent) return null
            return (
              <Row
                key={s.parent}
                node={parent}
                sub={`${s.parent} · de ${s.total} hijos, ${s.outside.length} en backlog`}
                extra={
                  <span className="text-[15px] font-semibold text-status-stop">
                    {s.outside.length}
                  </span>
                }
                onSelect={onSelect}
              />
            )
          })
        ) : (
          <p className="text-xs text-muted-foreground">
            Ninguna issue del ciclo tiene sub-issues afuera.
          </p>
        )}
      </Section>

      <Section label="Cuellos de botella">
        {bottlenecksList.length ? (
          bottlenecksList.slice(0, 5).map((b) => {
            const node = nodesById.get(b.id)
            if (!node) return null
            return (
              <Row
                key={b.id}
                node={node}
                sub={`${b.id} · ${node.status} · ${node.who ?? "sin asignar"} · frena ${b.downstreamPoints} pt`}
                extra={
                  <span className="text-[15px] font-semibold">
                    {b.downstreamCount}
                  </span>
                }
                onSelect={onSelect}
              />
            )
          })
        ) : (
          <p className="text-xs text-muted-foreground">
            No hay bloqueantes abiertos.
          </p>
        )}
      </Section>

      <Section label="Cadena más larga">
        <div className="flex flex-wrap items-center gap-1 text-[11.5px]">
          {chain.map((id, i) => {
            const node = nodesById.get(id)
            if (!node) return null
            return (
              <span key={id} className="flex items-center gap-1">
                {i > 0 && <span className="text-muted-foreground">→</span>}
                <button
                  type="button"
                  onClick={() => onSelect(id)}
                  className="rounded border px-1.5 py-0.5 font-semibold"
                  style={{ color: statusTextVar(node) }}
                >
                  {id}
                </button>
              </span>
            )
          })}
        </div>
        {chain.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            {chain.length} pasos en serie. Ningún atajo de paralelización los
            acorta.
          </p>
        )}
      </Section>

      <Section label={`Bloqueos abiertos · ${openBlocksList.length}`}>
        {openBlocksList.length ? (
          openBlocksList.map(([a, b]) => {
            const blocker = nodesById.get(a)
            const blocked = nodesById.get(b)
            if (!blocker) return null
            return (
              <Row
                key={`${a}|${b}`}
                node={blocker}
                label={`${blocker.short} → frena ${blocked?.short ?? b}`}
                sub={`${a} → ${b}`}
                onSelect={onSelect}
              />
            )
          })
        ) : (
          <p className="text-xs text-muted-foreground">
            No hay bloqueos abiertos.
          </p>
        )}
      </Section>

      <Separator className="mb-4" />
      <div className="flex flex-wrap gap-3.5 text-[11.5px] text-muted-foreground">
        {(
          [
            ["started", "In Progress"],
            ["started", "In Review"],
            ["unstarted", "Todo"],
            ["completed", "Done"],
            ["backlog", "Backlog"],
          ] as const
        ).map(([type, label]) => (
          <div key={label} className="flex items-center gap-1.5">
            <span
              className="size-1.5 rounded-full"
              style={{
                background: statusColorVar({ type, status: label }),
              }}
            />
            {label}
          </div>
        ))}
      </div>
    </>
  )
}
