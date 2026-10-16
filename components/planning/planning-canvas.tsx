"use client"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import { FocusIcon, MinusIcon, PlusIcon, ScanIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { layoutGraph, LAYOUT_METRICS } from "@/lib/graph/layout"
import { statusColorVar } from "@/components/graph/status-color"
import type { Snapshot } from "@/lib/schema/snapshot"
import { cn } from "@/lib/utils"

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
    const result = layoutGraph(snapshot, { showOutside: true })
    result.orphans.forEach((id, index) => {
      result.pos[id] = {
        x: 46 + (index % 3) * LAYOUT_METRICS.columnWidth,
        y: result.height + 30 + Math.floor(index / 3) * 86,
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
        x: rect.width / 2 - (point.x + 103),
        y: rect.height / 2 - (point.y + 32),
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
    const w = Math.max(...points.map((p) => p.x)) + 252
    const h = Math.max(...points.map((p) => p.y)) + 110
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
                opacity={highlighted && !highlighted.has(node.id) ? 0.3 : 1}
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
                <foreignObject x={point.x} y={point.y} width="206" height="64">
                  <div
                    className={cn(
                      "flex h-full items-center rounded-lg border bg-background",
                      ghost && "border-dashed border-muted-foreground/60",
                      selected === node.id && "border-ring ring-1 ring-ring"
                    )}
                  >
                    <button
                      className="flex h-full min-w-0 flex-1 cursor-pointer flex-col justify-center gap-1 px-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => {
                        lastAnchor.current = node.id
                        onSelect(node.id)
                      }}
                    >
                      <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span
                          className="size-1.5 rounded-full"
                          style={{ background: statusColorVar(node) }}
                        />
                        {node.id}
                        {ghost ? " · sugerida" : ` · ${node.pts ?? "—"} pt`}
                      </span>
                      <span
                        className="w-full truncate text-xs"
                        title={node.title}
                      >
                        {node.short}
                      </span>
                      <span className="w-full truncate text-[9px] text-muted-foreground">
                        {node.cycleName ?? "Sin ciclo"}
                      </span>
                    </button>
                    {ghost && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="mr-2"
                        disabled={busy}
                        aria-label={`Agregar ${node.id} a la hoja`}
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
