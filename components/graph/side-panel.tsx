"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeftIcon,
  ExternalLinkIcon,
  Loader2Icon,
  PlusIcon,
} from "lucide-react"

import { AnalyzeButton } from "@/components/graph/analyze-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Graph } from "@/lib/graph/build"
import { walk } from "@/lib/graph/metrics"
import type { Bottleneck, StrandedChildren } from "@/lib/graph/metrics"
import type {
  Analysis,
  Cycle,
  Node,
  TeamMember,
  TeamState,
} from "@/lib/schema/snapshot"
import { statusColorVar, statusTextVar } from "@/components/graph/status-color"
import { patchIssue } from "@/lib/api/patch-issue"
import { POINT_SCALE } from "@/lib/graph/points"
import { cn } from "@/lib/utils"

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

function StatusSelect({ node, states }: { node: Node; states: TeamState[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = saving || isPending

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const stateId = e.target.value
    if (!stateId || stateId === node.stateId) return
    setError(null)
    setSaving(true)
    patchIssue(node.id, { stateId })
      .then(() => startTransition(() => router.refresh()))
      .catch((err) => setError(err.message))
      .finally(() => setSaving(false))
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        {busy && (
          <Loader2Icon className="size-3 shrink-0 animate-spin text-muted-foreground" />
        )}
        <select
          value={node.stateId ?? ""}
          onChange={handleChange}
          disabled={busy}
          className="cursor-pointer rounded-md border border-transparent bg-transparent py-0.5 pr-0.5 pl-1.5 text-right text-xs font-semibold outline-none hover:border-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          style={{ color: statusTextVar(node) }}
        >
          {states.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-[10.5px] text-destructive">{error}</p>}
    </div>
  )
}

function AssigneeSelect({
  node,
  members,
}: {
  node: Node
  members: TeamMember[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = saving || isPending

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const assigneeId = e.target.value || null
    if (assigneeId === node.assigneeId) return
    setError(null)
    setSaving(true)
    patchIssue(node.id, { assigneeId })
      .then(() => startTransition(() => router.refresh()))
      .catch((err) => setError(err.message))
      .finally(() => setSaving(false))
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        {busy && (
          <Loader2Icon className="size-3 shrink-0 animate-spin text-muted-foreground" />
        )}
        <select
          value={node.assigneeId ?? ""}
          onChange={handleChange}
          disabled={busy}
          className="cursor-pointer rounded-md border border-transparent bg-transparent py-0.5 pr-0.5 pl-1.5 text-right text-xs outline-none hover:border-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        >
          <option value="">sin asignar</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-[10.5px] text-destructive">{error}</p>}
    </div>
  )
}

function PointsSelect({ node }: { node: Node }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = saving || isPending

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const raw = e.target.value
    const estimate = raw === "" ? null : Number(raw)
    if (estimate === (node.pts ?? null)) return
    setError(null)
    setSaving(true)
    patchIssue(node.id, { estimate })
      .then(() => startTransition(() => router.refresh()))
      .catch((err) => setError(err.message))
      .finally(() => setSaving(false))
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        {busy && (
          <Loader2Icon className="size-3 shrink-0 animate-spin text-muted-foreground" />
        )}
        <select
          value={node.pts != null ? String(node.pts) : ""}
          onChange={handleChange}
          disabled={busy}
          className="cursor-pointer rounded-md border border-transparent bg-transparent py-0.5 pr-0.5 pl-1.5 text-right text-xs outline-none hover:border-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        >
          <option value="">sin estimar</option>
          {POINT_SCALE.map((p) => (
            <option key={p} value={p}>
              {p} pt
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-[10.5px] text-destructive">{error}</p>}
    </div>
  )
}

function AddToCycleButton({ node, cycle }: { node: Node; cycle: Cycle }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleClick() {
    setError(null)
    patchIssue(node.id, { cycleId: cycle.id })
      .then(() => startTransition(() => router.refresh()))
      .catch((err) => setError(err.message))
  }

  return (
    <div className="mb-3.5 flex flex-col gap-1">
      <Button
        size="sm"
        variant="default"
        onClick={handleClick}
        disabled={isPending}
      >
        <PlusIcon data-icon="inline-start" />
        Agregar al Ciclo {cycle.number + 1}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
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
  cycle,
  states,
  members,
  onSelect,
  onBack,
  onHover,
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
  cycle: Cycle
  states: TeamState[]
  members: TeamMember[]
  onSelect: (id: string) => void
  onBack: () => void
  onHover: (id: string | null) => void
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
            cycle={cycle}
            states={states}
            members={members}
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
            onHover={onHover}
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
  cycle,
  states,
  members,
  onSelect,
  onBack,
}: {
  node: Node
  nodesById: Map<string, Node>
  graph: Graph
  workspace: string
  cycle: Cycle
  states: TeamState[]
  members: TeamMember[]
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

      {!node.inCycle && <AddToCycleButton node={node} cycle={cycle} />}

      <dl className="flex flex-col text-[12.5px]">
        <div className="flex items-center justify-between gap-3 border-b py-1.5">
          <dt className="text-muted-foreground">Estado</dt>
          <dd>
            <StatusSelect node={node} states={states} />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 border-b py-1.5">
          <dt className="text-muted-foreground">Responsable</dt>
          <dd>
            <AssigneeSelect node={node} members={members} />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 border-b py-1.5">
          <dt className="text-muted-foreground">Puntos</dt>
          <dd>
            <PointsSelect node={node} />
          </dd>
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
  onHover,
}: {
  nodesById: Map<string, Node>
  chain: string[]
  bottlenecksList: Bottleneck[]
  stranded: StrandedChildren[]
  openBlocksList: Array<[string, string]>
  analysis: Analysis | null
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
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
                  className={cn(
                    "mb-1.5",
                    d.sev === "media" &&
                      "bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400"
                  )}
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
                        onMouseEnter={() => onHover(id)}
                        onMouseLeave={() => onHover(null)}
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
    </>
  )
}
