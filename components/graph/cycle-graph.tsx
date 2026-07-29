"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { CycleHeader } from "@/components/graph/cycle-header"
import { EmptyCycleError } from "@/components/graph/empty-cycle-error"
import { SidePanel } from "@/components/graph/side-panel"
import { statusColorVar } from "@/components/graph/status-color"
import { StatusLegend } from "@/components/graph/status-legend"
import { ToggleBar, type ToggleKey } from "@/components/graph/toggle-bar"
import { usePollingSync } from "@/hooks/use-polling-sync"
import { buildGraph } from "@/lib/graph/build"
import { detectCycles } from "@/lib/graph/cycles"
import { LAYOUT_METRICS, layoutGraph } from "@/lib/graph/layout"
import {
  bottlenecks,
  longestChain,
  openBlocks,
  strandedChildren,
  walk,
} from "@/lib/graph/metrics"
import type { Snapshot } from "@/lib/schema/snapshot"

const { nodeWidth: NW, nodeHeight: NH } = LAYOUT_METRICS
const ORPHAN_TOP_GAP = 40
const ORPHAN_LABEL_HEIGHT = 34

function elbow(a: { x: number; y: number }, b: { x: number; y: number }) {
  const sx = a.x + NW
  const sy = a.y + NH / 2
  const tx = b.x
  const ty = b.y + NH / 2
  if (Math.abs(sy - ty) < 1) return `M${sx},${sy} L${tx},${ty}`
  const mx = sx + Math.max(26, (tx - sx) / 2)
  const r = Math.min(12, Math.abs(ty - sy) / 2)
  const s = ty > sy ? 1 : -1
  return `M${sx},${sy} L${mx - r},${sy} Q${mx},${sy} ${mx},${sy + s * r} L${mx},${ty - s * r} Q${mx},${ty} ${mx + r},${ty} L${tx},${ty}`
}

export function CycleGraph({
  snapshot,
  fullscreen = false,
}: {
  snapshot: Snapshot
  fullscreen?: boolean
}) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [active, setActive] = useState<ToggleKey[]>(["showOutside"])
  const [view, setView] = useState({ k: fullscreen ? 1.35 : 1, x: 0, y: 0 })
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  const [animating, setAnimating] = useState(false)
  const [orphansMounted, setOrphansMounted] = useState(false)
  const prevKRef = useRef(view.k)
  const animTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )
  const orphanUnmountRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )

  const showOutside = active.includes("showOutside")
  const showParents = active.includes("showParents")
  const showOrphans = active.includes("showOrphans")

  const nodesById = useMemo(
    () => new Map(snapshot.nodes.map((n) => [n.id, n])),
    [snapshot]
  )
  const graph = useMemo(() => buildGraph(snapshot), [snapshot])
  const cycles = useMemo(() => detectCycles(graph), [graph])
  const layout = useMemo(
    () => layoutGraph(snapshot, { showOutside }),
    [snapshot, showOutside]
  )

  const chain = useMemo(() => longestChain(graph), [graph])
  const bottlenecksList = useMemo(() => bottlenecks(graph), [graph])
  const strandedList = useMemo(
    () => strandedChildren(snapshot.nodes),
    [snapshot]
  )
  const openBlocksList = useMemo(() => openBlocks(graph), [graph])
  const orphans = useMemo(
    () => layout.orphans.map((id) => nodesById.get(id)!).filter(Boolean),
    [layout.orphans, nodesById]
  )
  const orphanCols = Math.max(1, layout.cols.length)
  const orphanRows = Math.ceil(orphans.length / orphanCols)
  const orphanAreaHeight = orphans.length
    ? ORPHAN_TOP_GAP + ORPHAN_LABEL_HEIGHT + orphanRows * LAYOUT_METRICS.rowHeight
    : 0
  const orphanStartY = layout.height + ORPHAN_TOP_GAP
  const orphanPos = useMemo(() => {
    const pos: Record<string, { x: number; y: number }> = {}
    orphans.forEach((n, i) => {
      const col = i % orphanCols
      const row = Math.floor(i / orphanCols)
      pos[n.id] = {
        x: LAYOUT_METRICS.padding + col * LAYOUT_METRICS.columnWidth,
        y: orphanStartY + ORPHAN_LABEL_HEIGHT + row * LAYOUT_METRICS.rowHeight,
      }
    })
    return pos
  }, [orphans, orphanCols, orphanStartY])

  const activeFocus = selected ?? hovered
  const lit = useMemo(() => {
    if (!activeFocus) return null
    return new Set([
      activeFocus,
      ...walk(activeFocus, layout.preds),
      ...walk(activeFocus, layout.succs),
    ])
  }, [activeFocus, layout])

  const selectedNode = selected ? (nodesById.get(selected) ?? null) : null

  usePollingSync()

  function centeredView(k: number, extraHeight = 0) {
    const height = canvasRef.current?.clientHeight ?? 0
    const totalHeight = layout.height + extraHeight
    const y = height ? Math.max(24, (height - totalHeight * k) / 2) : 0
    return { k, x: 0, y }
  }

  function animateTo(next: { k: number; x: number; y: number }) {
    setAnimating(true)
    setView(next)
    clearTimeout(animTimeoutRef.current)
    animTimeoutRef.current = setTimeout(() => setAnimating(false), 520)
  }

  function fitToOrphans() {
    const height = canvasRef.current?.clientHeight ?? 0
    const totalHeight = layout.height + orphanAreaHeight
    const available = height - 48
    const fitK = available > 0 ? available / totalHeight : view.k
    const k = Math.min(view.k, Math.max(0.45, fitK))
    return centeredView(k, orphanAreaHeight)
  }

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    let centered = false
    const observer = new ResizeObserver(() => {
      if (centered) return
      centered = true
      setView((v) => centeredView(v.k))
    })
    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (showOrphans) {
      if (!orphans.length) return
      prevKRef.current = view.k
      clearTimeout(orphanUnmountRef.current)
      setOrphansMounted(true)
      const frame = requestAnimationFrame(() => animateTo(fitToOrphans()))
      return () => cancelAnimationFrame(frame)
    }
    if (orphansMounted) {
      animateTo(centeredView(prevKRef.current))
      orphanUnmountRef.current = setTimeout(
        () => setOrphansMounted(false),
        480
      )
    }
    return () => clearTimeout(orphanUnmountRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showOrphans, orphans.length])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setSelected(null)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  function handleCanvasMouseDown(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("[data-node-id]")) return
    setDrag({ x: e.clientX - view.x, y: e.clientY - view.y })
  }
  function handleCanvasMouseMove(e: React.MouseEvent) {
    if (!drag) return
    setView((v) => ({ ...v, x: e.clientX - drag.x, y: e.clientY - drag.y }))
  }
  function handleCanvasWheel(e: React.WheelEvent) {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    setView((v) => ({
      ...v,
      k: Math.min(1.8, Math.max(0.45, v.k - e.deltaY * 0.0016)),
    }))
  }

  return (
    <div className="flex h-full flex-col">
      {!fullscreen && (
        <CycleHeader cycle={snapshot.cycle} nodes={snapshot.nodes} />
      )}
      <ToggleBar
        active={active}
        onToggle={setActive}
        onReset={() => {
          setSelected(null)
          animateTo(
            centeredView(
              fullscreen ? 1.35 : 1,
              showOrphans ? orphanAreaHeight : 0
            )
          )
        }}
      />
      <EmptyCycleError cycles={cycles} />
      <div className="flex min-h-0 flex-1">
        <div
          ref={canvasRef}
          className="relative min-w-0 flex-1 cursor-grab overflow-hidden bg-[radial-gradient(circle,color-mix(in_oklch,var(--foreground)_14%,transparent)_1px,transparent_1px)] bg-position-[0_0] bg-size-[20px_20px] active:cursor-grabbing"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={() => setDrag(null)}
          onMouseLeave={() => setDrag(null)}
          onWheel={handleCanvasWheel}
        >
          <svg width="100%" height="100%">
            <defs>
              <marker
                id="edge-arrow"
                viewBox="0 0 8 8"
                refX="7.5"
                refY="4"
                markerWidth="6.5"
                markerHeight="6.5"
                orient="auto"
              >
                <path d="M0,0 L8,4 L0,8 Z" fill="context-stroke" />
              </marker>
            </defs>
            <g
              style={{
                transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
                transformOrigin: "0 0",
                transition: animating
                  ? "transform 480ms cubic-bezier(0.22,1,0.36,1)"
                  : "none",
              }}
            >
              {layout.cols.map((_, l) => {
                const x =
                  LAYOUT_METRICS.padding + l * LAYOUT_METRICS.columnWidth - 18
                return (
                  <g key={l}>
                    <line
                      x1={x}
                      y1={LAYOUT_METRICS.padding - 22}
                      x2={x}
                      y2={layout.height - 14}
                      stroke="var(--border)"
                    />
                    <text
                      x={x + 8}
                      y={LAYOUT_METRICS.padding - 30}
                      className="fill-muted-foreground text-[10.5px] font-semibold tracking-wide uppercase"
                    >
                      {l === 0 ? "Sin bloqueos" : `Nivel ${l}`}
                    </text>
                  </g>
                )
              })}

              {showParents &&
                snapshot.nodes.map((n) => {
                  if (!n.parent || !layout.pos[n.id] || !layout.pos[n.parent])
                    return null
                  const a = layout.pos[n.parent]
                  const b = layout.pos[n.id]
                  const ax = a.x + NW / 2
                  const ay = a.y + NH / 2
                  const bx = b.x + NW / 2
                  const by = b.y + NH / 2
                  const bow = Math.max(40, Math.abs(by - ay) * 0.5)
                  return (
                    <path
                      key={n.id}
                      d={`M${ax},${ay} C${ax - bow},${ay} ${bx - bow},${by} ${bx},${by}`}
                      fill="none"
                      stroke="var(--status-review)"
                      strokeWidth={1}
                      strokeDasharray="2 4"
                      opacity={lit ? 0.12 : 0.4}
                      markerEnd="url(#edge-arrow)"
                    />
                  )
                })}

              {layout.edges
                .map(([a, b]) => {
                  const on = lit && lit.has(a) && lit.has(b)
                  const off = lit && !on
                  const blocker = nodesById.get(a)
                  const openEdge = blocker?.type !== "completed"
                  const stroke = on
                    ? "var(--foreground)"
                    : off
                      ? "var(--border)"
                      : openEdge
                        ? "var(--status-stop)"
                        : "var(--muted-foreground)"
                  return { a, b, on, off, openEdge, stroke }
                })
                .sort((x, y) => Number(x.on) - Number(y.on))
                .map(({ a, b, on, off, openEdge, stroke }) => (
                  <path
                    key={`${a}|${b}`}
                    d={elbow(layout.pos[a], layout.pos[b])}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={on ? 1.8 : openEdge && !off ? 1.3 : 1}
                    opacity={off ? 0.6 : 1}
                    markerEnd="url(#edge-arrow)"
                  />
                ))}

              {Object.entries(layout.pos).map(([id, p]) => {
                const n = nodesById.get(id)
                if (!n) return null
                const on = !lit || lit.has(id)
                const isSelected = selected === id
                const isHovered = hovered === id
                const blocked = (layout.preds[id] ?? []).some(
                  (x) => nodesById.get(x)?.type !== "completed"
                )
                const downCount = (layout.succs[id] ?? []).length
                const openBlocker = downCount > 0 && n.type !== "completed"

                return (
                  <g
                    key={id}
                    data-node-id={id}
                    transform={`translate(${p.x},${p.y})`}
                    opacity={on ? 1 : 0.16}
                    className="cursor-pointer"
                    onMouseEnter={() => setHovered(id)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => setSelected(selected === id ? null : id)}
                  >
                    {isHovered && (
                      <rect
                        x={-5}
                        y={-5}
                        width={NW + 10}
                        height={NH + 10}
                        rx={10}
                        fill="none"
                        stroke="var(--highlight)"
                        strokeWidth={2.5}
                        className="pointer-events-none animate-node-highlight"
                      />
                    )}
                    <rect
                      width={NW}
                      height={NH}
                      rx={6}
                      fill={
                        isHovered
                          ? "color-mix(in oklch, var(--highlight) 14%, var(--card))"
                          : "var(--card)"
                      }
                      stroke={
                        isSelected
                          ? "var(--foreground)"
                          : isHovered
                            ? "var(--highlight)"
                            : blocked
                              ? "color-mix(in oklch, var(--status-stop) 35%, var(--border))"
                              : "var(--border)"
                      }
                      strokeWidth={isSelected || isHovered ? 1.6 : 1}
                      strokeDasharray={n.inCycle ? undefined : "3 3"}
                    />
                    <rect
                      x={1.5}
                      y={1.5}
                      width={3.5}
                      height={NH - 3}
                      rx={1.75}
                      fill={statusColorVar(n)}
                    />
                    <text
                      x={16}
                      y={20}
                      className="fill-muted-foreground text-[10.5px] font-semibold"
                    >
                      {n.id}
                    </text>
                    <text
                      x={NW - 13}
                      y={20}
                      textAnchor="end"
                      className="fill-muted-foreground text-[10px]"
                    >
                      {n.pts ? `${n.pts} pt` : n.inCycle ? "—" : "fuera"}
                    </text>
                    <text
                      x={16}
                      y={38}
                      className="fill-foreground text-[12.5px] font-medium"
                    >
                      {n.short.length > 27
                        ? `${n.short.slice(0, 26)}…`
                        : n.short}
                    </text>
                    <text
                      x={16}
                      y={53}
                      className="fill-muted-foreground text-[10px]"
                    >
                      {n.who ?? "sin asignar"}
                    </text>
                    {downCount > 0 && (
                      <>
                        <rect
                          x={NW - 42}
                          y={42}
                          width={29}
                          height={15}
                          rx={4}
                          fill={
                            openBlocker
                              ? "color-mix(in oklch, var(--status-stop) 12%, transparent)"
                              : "var(--muted)"
                          }
                        />
                        <text
                          x={NW - 27.5}
                          y={53}
                          textAnchor="middle"
                          className="text-[10px] font-semibold"
                          fill={
                            openBlocker
                              ? "var(--status-stop)"
                              : "var(--muted-foreground)"
                          }
                        >
                          {downCount} ↓
                        </text>
                      </>
                    )}
                  </g>
                )
              })}

              {orphansMounted && orphans.length > 0 && (
                <g
                  style={{
                    opacity: showOrphans ? 1 : 0,
                    transition: "opacity 320ms ease",
                  }}
                >
                  <line
                    x1={LAYOUT_METRICS.padding - 18}
                    y1={orphanStartY}
                    x2={
                      LAYOUT_METRICS.padding -
                      18 +
                      orphanCols * LAYOUT_METRICS.columnWidth
                    }
                    y2={orphanStartY}
                    stroke="var(--border)"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={LAYOUT_METRICS.padding}
                    y={orphanStartY + 18}
                    className="fill-muted-foreground text-[10.5px] font-semibold tracking-wide uppercase"
                  >
                    Sin dependencias declaradas · {orphans.length} issues
                  </text>
                  {orphans.map((n) => {
                    const p = orphanPos[n.id]
                    if (!p) return null
                    return (
                      <g
                        key={n.id}
                        transform={`translate(${p.x},${p.y})`}
                        opacity={0.85}
                      >
                        <rect
                          width={NW}
                          height={NH}
                          rx={6}
                          fill="var(--card)"
                          stroke="var(--border)"
                          strokeWidth={1}
                          strokeDasharray="3 3"
                        />
                        <rect
                          x={1.5}
                          y={1.5}
                          width={3.5}
                          height={NH - 3}
                          rx={1.75}
                          fill={statusColorVar(n)}
                        />
                        <text
                          x={16}
                          y={20}
                          className="fill-muted-foreground text-[10.5px] font-semibold"
                        >
                          {n.id}
                        </text>
                        <text
                          x={16}
                          y={38}
                          className="fill-foreground text-[12.5px] font-medium"
                        >
                          {n.short.length > 27
                            ? `${n.short.slice(0, 26)}…`
                            : n.short}
                        </text>
                        <text
                          x={16}
                          y={53}
                          className="fill-muted-foreground text-[10px]"
                        >
                          {n.who ?? "sin asignar"}
                        </text>
                      </g>
                    )
                  })}
                </g>
              )}
            </g>
          </svg>
          <StatusLegend />
        </div>
        {!fullscreen && (
          <aside className="min-h-0 w-[356px] shrink-0 overflow-hidden border-l">
            <SidePanel
              selected={selectedNode}
              nodesById={nodesById}
              graph={graph}
              chain={chain}
              bottlenecksList={bottlenecksList}
              stranded={strandedList}
              openBlocksList={openBlocksList}
              analysis={snapshot.analysis}
              workspace={snapshot.cycle.workspace}
              onSelect={setSelected}
              onBack={() => setSelected(null)}
              onHover={setHovered}
            />
          </aside>
        )}
      </div>
    </div>
  )
}
