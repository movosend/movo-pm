"use client"

import { useState, type ReactNode } from "react"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BanIcon,
  ChevronRightIcon,
  CircleDashedIcon,
  PlayIcon,
  UserRoundIcon,
  ExternalLinkIcon,
  FocusIcon,
  LinkIcon,
  Loader2Icon,
  PlusIcon,
} from "lucide-react"
import { AnalyzeButton } from "@/components/graph/analyze-button"
import { IssueDescription } from "@/components/graph/issue-description"
import { useIssueUpdates } from "@/components/graph/issue-updates"
import { statusColorVar } from "@/components/graph/status-color"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type { Graph } from "@/lib/graph/build"
import {
  walk,
  type Bottleneck,
  type StrandedChildren,
} from "@/lib/graph/metrics"
import {
  actionGroups,
  CONDITIONS,
  pending,
  type Condition,
} from "@/lib/graph/view-state"
import { POINT_SCALE } from "@/lib/graph/points"
import type {
  Analysis,
  Cycle,
  Node,
  TeamMember,
  TeamState,
} from "@/lib/schema/snapshot"

function Row({
  node,
  sub,
  extra,
  onSelect,
}: {
  node: Node
  sub: string
  extra?: ReactNode
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-md p-2 text-left hover:bg-muted focus-visible:outline-ring"
      >
        <span
          className="size-1.5 shrink-0 rounded-full"
          style={{ background: statusColorVar(node) }}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs">{node.short}</span>
          <span className="block text-[11px] text-muted-foreground">{sub}</span>
        </span>
      </button>
      {extra}
    </div>
  )
}
function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold text-muted-foreground">{label}</h3>
      <Separator />
      {children}
    </section>
  )
}
function IssueField({
  node,
  field,
  label,
  options,
  value,
}: {
  node: Node
  field: "stateId" | "assigneeId" | "estimate"
  label: string
  value: string
  options: { id: string; name: string }[]
}) {
  const { mutate, busy } = useIssueUpdates()
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        {busy.has(node.id) && (
          <Loader2Icon className="size-3 animate-spin" aria-label="Guardando" />
        )}
        <select
          aria-label={`${label} de ${node.id}`}
          value={value}
          disabled={busy.has(node.id)}
          onChange={(event) => {
            const raw = event.target.value
            setError(null)
            const next =
              field === "estimate"
                ? raw === ""
                  ? null
                  : Number(raw)
                : raw || null
            if (field === "stateId" && next === null) return
            void mutate(node.id, { [field]: next }).catch((error: Error) =>
              setError(error.message)
            )
          }}
          className="max-w-56 rounded-md border bg-background px-2 py-1 text-xs disabled:opacity-50"
        >
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
function AddToCycleButton({ node, cycle }: { node: Node; cycle: Cycle }) {
  const { mutate, busy } = useIssueUpdates()
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy.has(node.id)}
      onClick={() => {
        void mutate(node.id, { cycleId: cycle.id }).catch(() => {})
      }}
    >
      {busy.has(node.id) ? (
        <Loader2Icon data-icon="inline-start" className="animate-spin" />
      ) : (
        <PlusIcon data-icon="inline-start" />
      )}
      Agregar al ciclo
    </Button>
  )
}
export type PanelProps = {
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
  onFocus?: () => void
  onShareIssue: () => void
  group: Condition | null
  onGroup: (group: Condition | null) => void
}
export function SidePanel(props: PanelProps) {
  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-5 p-4">
        {props.selected ? (
          <DetailView
            key={props.selected.id}
            {...props}
            node={props.selected}
          />
        ) : (
          <SummaryView {...props} />
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
  onFocus,
  onShareIssue,
}: PanelProps & { node: Node }) {
  const preds = graph.preds[node.id] ?? []
  const downstream = [...walk(node.id, graph.succs)].filter(
    (id) => id !== node.id
  )
  const children = [...nodesById.values()].filter((n) => n.parent === node.id)
  const parent = node.parent ? nodesById.get(node.parent) : null
  const noBlockers = !preds.some((id) => {
    const blocker = nodesById.get(id)
    return blocker && pending(blocker)
  })
  return (
    <>
      <div className="flex flex-col gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={onBack}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          Volver al resumen
        </Button>
        <span className="text-xs font-semibold text-muted-foreground">
          {node.id}
        </span>
        <h2 className="text-[15px] leading-snug font-semibold tracking-tight">
          {node.title}
        </h2>
        <div className="flex flex-wrap gap-2">
          {onFocus && (
            <Button variant="outline" size="sm" onClick={onFocus}>
              <FocusIcon data-icon="inline-start" />
              Enfocar en el grafo
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onShareIssue}>
            <LinkIcon data-icon="inline-start" />
            Copiar enlace de issue
          </Button>
        </div>
        {!node.inCycle && <AddToCycleButton node={node} cycle={cycle} />}
      </div>
      <dl className="flex flex-col gap-3 text-xs">
        <div className="flex items-center justify-between gap-3">
          <dt>Estado</dt>
          <dd>
            <IssueField
              node={node}
              label="Estado"
              field="stateId"
              value={node.stateId ?? ""}
              options={[
                ...(!node.stateId ? [{ id: "", name: node.status }] : []),
                ...states.map((state) => ({ id: state.id, name: state.name })),
              ]}
            />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt>Responsable</dt>
          <dd>
            <IssueField
              node={node}
              label="Responsable"
              field="assigneeId"
              value={node.assigneeId ?? ""}
              options={[{ id: "", name: "Sin responsable" }, ...members]}
            />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt>Puntos</dt>
          <dd>
            <IssueField
              node={node}
              label="Puntos"
              field="estimate"
              value={node.pts === null ? "" : String(node.pts)}
              options={[
                { id: "", name: "Sin estimar" },
                ...[
                  ...new Set([
                    ...POINT_SCALE,
                    ...(node.pts === null ? [] : [node.pts]),
                  ]),
                ]
                  .sort((a, b) => a - b)
                  .map((point) => ({ id: String(point), name: `${point} pt` })),
              ]}
            />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt>En el ciclo</dt>
          <dd>{node.inCycle ? "Sí" : "No"}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt>Linear</dt>
          <dd>
            <a
              href={`https://linear.app/${workspace}/issue/${node.id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Abrir en Linear
              <ExternalLinkIcon className="size-3" />
            </a>
          </dd>
        </div>
      </dl>
      <Section label="Descripción">
        <IssueDescription description={node.description} />
      </Section>
      {node.parent && (
        <Section label="Issue padre">
          {parent ? (
            <Row
              node={parent}
              sub={`${parent.id} · ${parent.status}`}
              onSelect={onSelect}
            />
          ) : (
            <a
              className="text-xs text-primary underline"
              href={`https://linear.app/${workspace}/issue/${node.parent}`}
              target="_blank"
              rel="noreferrer"
            >
              {node.parent} · Abrir en Linear
            </a>
          )}
        </Section>
      )}
      {children.length > 0 && (
        <Section label={`Sub-issues · ${children.length}`}>
          {children.map((child) => (
            <Row
              key={child.id}
              node={child}
              sub={`${child.id} · ${child.status}`}
              extra={
                child.inCycle ? (
                  <Badge variant="secondary">En ciclo</Badge>
                ) : (
                  <AddToCycleButton node={child} cycle={cycle} />
                )
              }
              onSelect={onSelect}
            />
          ))}
        </Section>
      )}
      <Section label={`Bloqueado por · ${preds.length}`}>
        {preds.map((id) => {
          const blocker = nodesById.get(id)
          return blocker ? (
            <Row
              key={id}
              node={blocker}
              sub={`${id} · ${blocker.status}`}
              extra={
                <Badge variant={pending(blocker) ? "destructive" : "secondary"}>
                  {pending(blocker) ? "Pendiente" : "Resuelto"}
                </Badge>
              }
              onSelect={onSelect}
            />
          ) : null
        })}
        {noBlockers && (
          <p className="text-xs text-muted-foreground">
            {pending(node)
              ? "No tiene bloqueos pendientes."
              : "Esta issue ya está resuelta."}
          </p>
        )}
      </Section>
      <Section label={`Dependientes · ${downstream.length}`}>
        {downstream.length ? (
          downstream.map((id) => {
            const dependent = nodesById.get(id)
            return dependent ? (
              <Row
                key={id}
                node={dependent}
                sub={`${id} · ${dependent.status}`}
                extra={
                  <Badge variant="outline">
                    {(graph.succs[node.id] ?? []).includes(id)
                      ? "Directo"
                      : "Indirecto"}
                  </Badge>
                }
                onSelect={onSelect}
              />
            ) : null
          })
        ) : (
          <p className="text-xs text-muted-foreground">
            No hay issues esperando esta issue.
          </p>
        )}
      </Section>
    </>
  )
}
const EMPTY_MESSAGES: Record<Condition, string> = {
  blocked: "No hay pendientes bloqueadas.",
  ready: "No hay issues listas para empezar.",
  unestimated: "No hay pendientes sin estimar.",
  unassigned: "No hay pendientes sin responsable.",
}
function SummaryView({
  nodesById,
  graph,
  chain,
  bottlenecksList,
  stranded,
  openBlocksList,
  analysis,
  onSelect,
  onHover,
  group,
  onGroup,
}: PanelProps) {
  const groups = actionGroups([...nodesById.values()], graph)
  if (group)
    return (
      <>
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => onGroup(null)}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          Volver al resumen
        </Button>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">{CONDITIONS[group]}</h2>
          <span className="text-xs text-muted-foreground tabular-nums">
            {groups[group].length} issues
          </span>
        </div>
        {groups[group].length ? (
          groups[group].map((node) => (
            <Row
              key={node.id}
              node={node}
              sub={`${node.id} · ${node.status} · ${node.who ?? "Sin responsable"}`}
              onSelect={onSelect}
            />
          ))
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Todo al día</EmptyTitle>
              <EmptyDescription>{EMPTY_MESSAGES[group]}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </>
    )
  const actions = [
    {
      key: "blocked",
      icon: BanIcon,
      description: "Revisar qué impide avanzar",
    },
    { key: "ready", icon: PlayIcon, description: "Sin bloqueos pendientes" },
    {
      key: "unestimated",
      icon: CircleDashedIcon,
      description: "Completar la estimación",
    },
    {
      key: "unassigned",
      icon: UserRoundIcon,
      description: "Asignar un responsable",
    },
  ] as const
  return (
    <>
      <div>
        <h2 className="text-sm font-semibold">Acciones del ciclo</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Pendientes para revisar y destrabar.
        </p>
      </div>
      <div className="flex flex-col">
        {actions.map(({ key, icon: Icon, description }, index) => (
          <div key={key}>
            {index > 0 && <Separator />}
            <button
              type="button"
              onClick={() => onGroup(key)}
              aria-label={`Ver ${CONDITIONS[key].toLowerCase()}`}
              className="group/action -mx-2 flex w-[calc(100%+1rem)] cursor-pointer items-center gap-3 rounded-md px-2 py-3 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Icon
                className={cn(
                  "size-4 shrink-0 text-muted-foreground",
                  key === "blocked" &&
                    groups[key].length > 0 &&
                    "text-status-stop"
                )}
              />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[13px] font-medium">
                  {CONDITIONS[key]}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {description}
                </span>
              </span>
              <span
                className={cn(
                  "text-[13px] font-medium tabular-nums",
                  !groups[key].length && "text-muted-foreground"
                )}
              >
                {groups[key].length}
              </span>
              <ArrowRightIcon className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover/action:opacity-100 group-focus-visible/action:opacity-100" />
            </button>
          </div>
        ))}
      </div>
      <Separator />
      <details className="group/risks">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
          <ChevronRightIcon className="size-3.5 transition-transform group-open/risks:rotate-90" />
          Dependencias y riesgos
        </summary>
        <div className="mt-4 flex flex-col gap-5">
          <Section label="Cuellos de botella">
            {bottlenecksList
              .filter((b) => {
                const node = nodesById.get(b.id)
                return node && pending(node)
              })
              .slice(0, 5)
              .map((b) => {
                const node = nodesById.get(b.id)!
                return (
                  <Row
                    key={b.id}
                    node={node}
                    sub={`${b.id} · ${b.downstreamCount} dependientes · ${b.downstreamPoints} pt`}
                    onSelect={onSelect}
                  />
                )
              })}
            {!bottlenecksList.length && (
              <p className="text-xs text-muted-foreground">
                No hay cuellos de botella.
              </p>
            )}
          </Section>
          <Section label="Cadena de dependencias">
            <div className="flex flex-wrap items-center gap-1">
              {chain.map((id) => (
                <Button
                  key={id}
                  variant="outline"
                  size="xs"
                  onClick={() => onSelect(id)}
                >
                  {id}
                </Button>
              ))}
            </div>
            {!chain.length && (
              <p className="text-xs text-muted-foreground">
                No hay cadenas de dependencias.
              </p>
            )}
          </Section>
          <Section label="Sub-issues fuera del ciclo">
            {stranded.map((entry) => {
              const node = nodesById.get(entry.parent)
              return node ? (
                <Row
                  key={node.id}
                  node={node}
                  sub={`${node.id} · ${entry.outside.length} sub-issues fuera del ciclo`}
                  onSelect={onSelect}
                />
              ) : null
            })}
            {!stranded.length && (
              <p className="text-xs text-muted-foreground">
                No hay sub-issues fuera del ciclo.
              </p>
            )}
          </Section>
          <p className="text-xs text-muted-foreground">
            {
              openBlocksList.filter(([a, b]) => {
                const blocker = nodesById.get(a)
                const target = nodesById.get(b)
                return blocker && target && pending(blocker) && pending(target)
              }).length
            }{" "}
            relaciones de bloqueo pendientes.
          </p>
        </div>
      </details>
      <details className="group/analysis">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
          <ChevronRightIcon className="size-3.5 transition-transform group-open/analysis:rotate-90" />
          Análisis de IA
        </summary>
        <div className="mt-4 flex flex-col gap-3">
          <AnalyzeButton hasAnalysis={Boolean(analysis)} />
          {analysis ? (
            <>
              <p className="text-xs text-muted-foreground">
                Actualizado: {analysis.generated}
              </p>
              <p className="text-sm">{analysis.headline}</p>
              {analysis.decisions.map((decision, index) => (
                <section
                  key={index}
                  className="flex flex-col gap-2 border-l-2 pl-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-semibold">{decision.title}</h4>
                    <Badge
                      variant={
                        decision.sev === "alta" ? "destructive" : "secondary"
                      }
                    >
                      {decision.sev}
                    </Badge>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {decision.body}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {decision.issues.map((id) => (
                      <Button
                        key={id}
                        variant="outline"
                        size="xs"
                        onClick={() => onSelect(id)}
                        onMouseEnter={() => onHover(id)}
                        onMouseLeave={() => onHover(null)}
                      >
                        {id}
                      </Button>
                    ))}
                  </div>
                </section>
              ))}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Generá un análisis para revisar riesgos y decisiones.
            </p>
          )}
        </div>
      </details>
    </>
  )
}
