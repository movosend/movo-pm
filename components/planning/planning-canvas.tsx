"use client"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import {
  CheckIcon,
  FocusIcon,
  MinusIcon,
  PlusIcon,
  ScanIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { planningLayout, PLANNING_CARD as CARD } from "@/lib/planning/layout"
import { statusColorVar } from "@/components/graph/status-color"
import type { Snapshot } from "@/lib/schema/snapshot"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export function PlanningCanvas({
  snapshot,
  included,
  selected,
  highlighted,
  onSelect,
  onAdd,
  onConnect,
  busy,
  focusRequest,
}: {
  snapshot: Snapshot
  included: Set<string>
  selected: string | null
  highlighted: Set<string> | null
  onSelect: (id: string) => void
  onConnect: (blocker: string, blocked: string) => Promise<void>
  onAdd: (id: string) => void
  busy: boolean
  focusRequest: number
}) {
  type Connection = {
    source: string
    x: number
    y: number
    target: string | null
    keyboard?: boolean
  }
  const svg = useRef<SVGSVGElement>(null)
  const [connection, setConnection] = useState<Connection | null>(null)
  const connectionRef = useRef<Connection | null>(null)
  const [saving, setSaving] = useState(false)
  function updateConnection(value: Connection | null) {
    connectionRef.current = value
    setConnection(value)
  }
  useEffect(() => {
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        connectionRef.current = null
        setConnection(null)
      }
    }
    window.addEventListener("keydown", escape)
    return () => window.removeEventListener("keydown", escape)
  }, [])
  const marker = useId().replaceAll(":", "")
  const container = useRef<HTMLDivElement>(null)
  const [view, setView] = useState({ x: 20, y: 20, k: 1 })
  const drag = useRef<{ x: number; y: number } | null>(null)
  const lastLayout = useRef<Record<string, { x: number; y: number }>>({})
  const lastAnchor = useRef<string | null>(null)
  const layout = useMemo(() => planningLayout(snapshot), [snapshot])
  // Keep the selected/expanded card at the same screen position when dagre reflows.
  useEffect(() => {
    const anchor = lastAnchor.current
    const before = anchor ? lastLayout.current[anchor] : null
    const after = anchor ? layout.pos[anchor] : null
    if (before && after) {
      const frame = requestAnimationFrame(() =>
        setView((value) => ({
          ...value,
          x: value.x + (before.x - after.x) * value.k,
          y: value.y + (before.y - after.y) * value.k,
        }))
      )
      lastLayout.current = layout.pos
      return () => cancelAnimationFrame(frame)
    }
    lastLayout.current = layout.pos
  }, [layout])
  function invalidTarget(source: string, target: string) {
    if (source === target) return "Elegí otra US"
    if (snapshot.blocks.some(([a, b]) => a === source && b === target))
      return "Este bloqueo ya existe"
    if (snapshot.blocks.some(([a, b]) => a === target && b === source))
      return "Ya existe el bloqueo inverso"
    return null
  }
  function moveConnection(clientX: number, clientY: number) {
    const current = connectionRef.current
    const rect = svg.current?.getBoundingClientRect()
    if (!current || !rect) return
    const x = (clientX - rect.left - view.x) / view.k
    const y = (clientY - rect.top - view.y) / view.k
    const target =
      Object.entries(layout.pos).find(
        ([, p]) =>
          x >= p.x - 12 &&
          x <= p.x + CARD.nodeWidth + 12 &&
          y >= p.y - 8 &&
          y <= p.y + CARD.nodeHeight + 8
      )?.[0] ?? null
    updateConnection({ ...current, x, y, target })
  }
  async function finishConnection(target: string | null) {
    const current = connectionRef.current
    updateConnection(null)
    if (!current || busy || saving) return
    if (!target || invalidTarget(current.source, target)) return
    lastAnchor.current = current.source
    setSaving(true)
    try {
      await onConnect(current.source, target)
    } finally {
      setSaving(false)
    }
  }
  function focus() {
    const point = selected ? layout.pos[selected] : null
    const rect = container.current?.getBoundingClientRect()
    if (point && rect)
      setView({
        x: rect.width / 2 - (point.x + CARD.nodeWidth / 2),
        y: rect.height / 2 - (point.y + CARD.nodeHeight / 2),
        k: 1,
      })
  }
  const focusRef = useRef(focus)
  useEffect(() => {
    focusRef.current = focus
  })
  useEffect(() => {
    if (focusRequest) focusRef.current()
  }, [focusRequest])
  function fit() {
    const points = Object.values(layout.pos)
    const rect = container.current?.getBoundingClientRect()
    if (!points.length || !rect) return
    const w = Math.max(...points.map((p) => p.x)) + CARD.nodeWidth + 46
    const h = Math.max(...points.map((p) => p.y)) + CARD.nodeHeight + 46
    const k = Math.min(
      1.2,
      Math.max(0.25, Math.min(rect.width / w, rect.height / h))
    )
    setView({ x: (rect.width - w * k) / 2, y: (rect.height - h * k) / 2, k })
  }
  return (
    <div
      ref={container}
      className="relative min-h-64 min-w-0 flex-1 overflow-hidden bg-muted/20"
    >
      <div className="absolute top-3 left-3 flex gap-1 rounded-lg border bg-background p-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Reencuadrar"
          title="Reencuadrar"
          onClick={fit}
        >
          <ScanIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Alejar"
          onClick={() =>
            setView((v) => ({ ...v, k: Math.max(0.25, v.k - 0.15) }))
          }
        >
          <MinusIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Acercar"
          onClick={() =>
            setView((v) => ({ ...v, k: Math.min(1.8, v.k + 0.15) }))
          }
        >
          <PlusIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Enfocar issue"
          disabled={!selected || !layout.pos[selected]}
          onClick={focus}
        >
          <FocusIcon />
        </Button>
      </div>
      <div
        role="status"
        className="pointer-events-none absolute bottom-14 left-3 max-w-[calc(100%-1.5rem)] rounded-md bg-background/95 px-3 py-1.5 text-[11px] text-muted-foreground"
      >
        {saving
          ? "Guardando dependencia en Linear…"
          : connection
            ? connection.target
              ? (invalidTarget(connection.source, connection.target) ??
                `${connection.source} bloquea a ${connection.target} · ${connection.keyboard ? "Enter" : "Soltá"} para guardar en Linear · Esc cancela`)
              : `${connection.source} bloquea a… Elegí la US destino · Esc cancela`
            : "Arrastrá desde el punto derecho de una US hacia otra para crear un bloqueo en Linear."}
      </div>
      <div className="pointer-events-none absolute right-3 bottom-3 flex items-center gap-3 rounded-lg border bg-background/95 px-3 py-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded border-2 border-primary/40 bg-accent" />
          En el plan
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded border border-dashed border-muted-foreground" />
          Sugerida · no incluida
        </span>
      </div>
      {!snapshot.nodes.length && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Explorá una propuesta</EmptyTitle>
              <EmptyDescription>
                Buscá una issue para agregarla. Sus dependencias aparecerán como
                sugerencias.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </div>
      )}
      <svg
        ref={svg}
        className={cn("size-full touch-none", connection && "cursor-crosshair")}
        aria-label="Grafo de la hoja de planificación"
        onPointerDown={(event) => {
          if (
            connectionRef.current ||
            saving ||
            event.button !== 0 ||
            (event.target as Element).closest("button, [data-connector]")
          )
            return
          event.currentTarget.setPointerCapture(event.pointerId)
          drag.current = { x: event.clientX, y: event.clientY }
        }}
        onPointerMove={(event) => {
          if (connectionRef.current && !connectionRef.current.keyboard) {
            moveConnection(event.clientX, event.clientY)
            return
          }
          if (!drag.current) return
          const dx = event.clientX - drag.current.x,
            dy = event.clientY - drag.current.y
          drag.current = { x: event.clientX, y: event.clientY }
          setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }))
        }}
        onPointerUp={(event) => {
          drag.current = null
          if (connectionRef.current && !connectionRef.current.keyboard) {
            moveConnection(event.clientX, event.clientY)
            void finishConnection(connectionRef.current?.target ?? null)
          }
        }}
        onLostPointerCapture={() => {
          drag.current = null
          if (!connectionRef.current?.keyboard) updateConnection(null)
        }}
        onPointerCancel={() => {
          updateConnection(null)
          drag.current = null
        }}
        onWheel={(event) =>
          !connectionRef.current &&
          setView((v) =>
            event.ctrlKey || event.metaKey
              ? {
                  ...v,
                  k: Math.min(1.8, Math.max(0.25, v.k - event.deltaY * 0.003)),
                }
              : { ...v, x: v.x - event.deltaX, y: v.y - event.deltaY }
          )
        }
      >
        <defs>
          <marker
            id={marker}
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
          >
            <path d="M0,0 L8,4 L0,8" fill="var(--muted-foreground)" />
          </marker>
        </defs>
        <g transform={`translate(${view.x}, ${view.y}) scale(${view.k})`}>
          {layout.edges.map(([a, b]) => {
            const points = layout.edgeRoutes[`${a}|${b}`]
            if (!points?.length) return null
            return (
              <polyline
                key={`${a}|${b}`}
                points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="var(--muted-foreground)"
                opacity=".45"
                strokeWidth="1.3"
                strokeDasharray={
                  !included.has(a) || !included.has(b) ? "4 4" : undefined
                }
                markerEnd={`url(#${marker})`}
              />
            )
          })}
          {connection &&
            layout.pos[connection.source] &&
            (() => {
              const origin = layout.pos[connection.source]
              const target = connection.target
                ? layout.pos[connection.target]
                : null
              const x1 = origin.x + CARD.nodeWidth + 8,
                y1 = origin.y + CARD.nodeHeight / 2
              const x2 = target ? target.x - 5 : connection.x,
                y2 = target ? target.y + CARD.nodeHeight / 2 : connection.y
              const bend = Math.max(50, Math.abs(x2 - x1) / 2)
              return (
                <path
                  d={`M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}`}
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  markerEnd={`url(#${marker})`}
                  className="pointer-events-none"
                />
              )
            })()}
          {snapshot.nodes.map((node) => {
            const point = layout.pos[node.id]
            if (!point) return null
            const ghost = !included.has(node.id)
            return (
              <g
                key={node.id}
                opacity={
                  !connection &&
                  highlighted &&
                  !highlighted.has(node.id) &&
                  selected !== node.id
                    ? 0.3
                    : 1
                }
              >
                {node.parent && (
                  <text
                    x={point.x + 3}
                    y={point.y - 5}
                    fontSize="9"
                    fill="var(--muted-foreground)"
                  >
                    <title>{node.parentTitle ?? node.parent}</title>
                    {(node.parentTitle ?? node.parent).slice(0, 35)}
                  </text>
                )}
                {(selected === node.id || connection?.target === node.id) && (
                  <rect
                    x={point.x - 4}
                    y={point.y - 4}
                    width={CARD.nodeWidth + 8}
                    height={CARD.nodeHeight + 8}
                    rx={12}
                    fill="none"
                    stroke={
                      connection?.target === node.id &&
                      invalidTarget(connection.source, node.id)
                        ? "var(--destructive)"
                        : "var(--primary)"
                    }
                    strokeDasharray={
                      connection?.target === node.id ? "4 3" : undefined
                    }
                    strokeWidth={2}
                    className="pointer-events-none"
                  />
                )}
                <foreignObject
                  x={point.x}
                  y={point.y}
                  width={CARD.nodeWidth}
                  height={CARD.nodeHeight}
                >
                  <div
                    className={cn(
                      "flex h-full items-center overflow-hidden rounded-lg border-2",
                      ghost
                        ? "border-dashed border-muted-foreground/40 bg-background"
                        : "border-primary/40 bg-accent"
                    )}
                  >
                    <button
                      className="flex h-full min-w-0 flex-1 cursor-pointer flex-col justify-center gap-1 px-3 text-left outline-none focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                      onFocus={() => {
                        const current = connectionRef.current
                        if (current?.keyboard)
                          updateConnection({ ...current, target: node.id })
                      }}
                      onClick={() => {
                        if (connectionRef.current) {
                          void finishConnection(node.id)
                          return
                        }
                        lastAnchor.current = node.id
                        onSelect(node.id)
                      }}
                    >
                      <span className="flex w-full items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span
                          className="size-1.5 shrink-0 rounded-full"
                          style={{ background: statusColorVar(node) }}
                        />
                        {node.id}
                        <span className="ml-auto">
                          {node.pts === null ? "Sin estimar" : `${node.pts} pt`}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "w-full truncate text-xs",
                          !ghost && "font-medium"
                        )}
                        title={node.title}
                      >
                        {node.short}
                      </span>
                      <span className="flex w-full items-center gap-2">
                        <Badge variant={ghost ? "outline" : "secondary"}>
                          {ghost ? (
                            "Sugerida"
                          ) : (
                            <>
                              <CheckIcon data-icon="inline-start" />
                              En el plan
                            </>
                          )}
                        </Badge>
                        <span
                          className="truncate text-[9px] text-muted-foreground"
                          title={node.cycleName ?? "Sin ciclo"}
                        >
                          {node.cycleName ?? "Sin ciclo"}
                        </span>
                      </span>
                    </button>
                    {ghost && (
                      <Button
                        variant="outline"
                        size="icon-xs"
                        className="mr-2"
                        disabled={busy}
                        aria-label={`Agregar ${node.id} al plan`}
                        title="Agregar al plan"
                        onClick={() => {
                          lastAnchor.current = node.id
                          onAdd(node.id)
                        }}
                      >
                        <PlusIcon />
                      </Button>
                    )}
                  </div>
                </foreignObject>
                {!ghost && (
                  <g
                    data-connector="true"
                    role="button"
                    tabIndex={busy || saving ? -1 : 0}
                    aria-disabled={busy || saving}
                    aria-label={`Crear bloqueo desde ${node.id}. Arrastrá hacia otra US o presioná Enter y elegí el destino.`}
                    className={cn(
                      "outline-none",
                      busy || saving
                        ? "opacity-40"
                        : "cursor-crosshair text-muted-foreground hover:text-primary focus:text-primary"
                    )}
                    onPointerDown={(event) => {
                      event.stopPropagation()
                      if (busy || saving || event.button !== 0) return
                      event.preventDefault()
                      drag.current = null
                      svg.current?.setPointerCapture(event.pointerId)
                      updateConnection({
                        source: node.id,
                        x: point.x + CARD.nodeWidth + 8,
                        y: point.y + CARD.nodeHeight / 2,
                        target: null,
                      })
                    }}
                    onKeyDown={(event) => {
                      if (
                        (event.key === "Enter" || event.key === " ") &&
                        !busy &&
                        !saving
                      ) {
                        event.preventDefault()
                        updateConnection({
                          source: node.id,
                          x: point.x + CARD.nodeWidth + 48,
                          y: point.y + CARD.nodeHeight / 2,
                          target: null,
                          keyboard: true,
                        })
                      }
                    }}
                  >
                    <title>
                      Arrastrá para indicar qué US bloquea {node.id}
                    </title>
                    <circle
                      cx={point.x + CARD.nodeWidth + 8}
                      cy={point.y + CARD.nodeHeight / 2}
                      r={14}
                      fill="transparent"
                    />
                    <circle
                      cx={point.x + CARD.nodeWidth + 8}
                      cy={point.y + CARD.nodeHeight / 2}
                      r={5}
                      fill="var(--background)"
                      stroke="currentColor"
                      strokeWidth={2}
                    />
                  </g>
                )}
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}
