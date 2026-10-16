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
import { layoutGraph } from "@/lib/graph/layout"
import { statusColorVar } from "@/components/graph/status-color"
import type { Snapshot } from "@/lib/schema/snapshot"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const CARD = {
  nodeWidth: 244,
  nodeHeight: 88,
  columnWidth: 320,
  rowHeight: 118,
}

export function PlanningCanvas({
  snapshot,
  included,
  selected,
  highlighted,
  onSelect,
  onAdd,
  busy,
  focusRequest,
}: {
  snapshot: Snapshot
  included: Set<string>
  selected: string | null
  highlighted: Set<string> | null
  onSelect: (id: string) => void
  onAdd: (id: string) => void
  busy: boolean
  focusRequest: number
}) {
  const marker = useId().replaceAll(":", "")
  const container = useRef<HTMLDivElement>(null)
  const [view, setView] = useState({ x: 20, y: 20, k: 1 })
  const drag = useRef<{ x: number; y: number } | null>(null)
  const lastLayout = useRef<Record<string, { x: number; y: number }>>({})
  const lastAnchor = useRef<string | null>(null)
  const layout = useMemo(() => {
    const result = layoutGraph(snapshot, { showOutside: true, metrics: CARD })
    result.orphans.forEach((id, index) => {
      result.pos[id] = {
        x: 46 + (index % 3) * CARD.columnWidth,
        y: result.height + 30 + Math.floor(index / 3) * CARD.rowHeight,
      }
    })
    return result
  }, [snapshot])
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
        className="size-full touch-none"
        aria-label="Grafo de la hoja de planificación"
        onPointerDown={(event) => {
          if ((event.target as Element).closest("button")) return
          event.currentTarget.setPointerCapture(event.pointerId)
          drag.current = { x: event.clientX, y: event.clientY }
        }}
        onPointerMove={(event) => {
          if (!drag.current) return
          const dx = event.clientX - drag.current.x,
            dy = event.clientY - drag.current.y
          drag.current = { x: event.clientX, y: event.clientY }
          setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }))
        }}
        onPointerUp={() => {
          drag.current = null
        }}
        onPointerCancel={() => {
          drag.current = null
        }}
        onWheel={(event) =>
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
          {snapshot.nodes.map((node) => {
            const point = layout.pos[node.id]
            if (!point) return null
            const ghost = !included.has(node.id)
            return (
              <g
                key={node.id}
                opacity={
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
                {selected === node.id && (
                  <rect
                    x={point.x - 4}
                    y={point.y - 4}
                    width={CARD.nodeWidth + 8}
                    height={CARD.nodeHeight + 8}
                    rx={12}
                    fill="none"
                    stroke="var(--primary)"
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
                      onClick={() => {
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
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}
