"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useGraphLocation } from "@/hooks/use-graph-location"
import { FilterBar, ActiveFilters } from "@/components/graph/filter-bar"
import {
  IssueUpdatesProvider,
  useIssueUpdates,
} from "@/components/graph/issue-updates"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  emptyFilters,
  hasFilters,
  matchesFilters,
  type Condition,
  type Filters,
  type Visibility,
} from "@/lib/graph/view-state"
import { Button } from "@/components/ui/button"

import { CycleHeader } from "@/components/graph/cycle-header"
import { EmptyCycleError } from "@/components/graph/empty-cycle-error"
import { IssueSearchCommand } from "@/components/graph/issue-search-command"
import { RemoteIssuePanel } from "@/components/graph/remote-issue-panel"
import { SidePanel } from "@/components/graph/side-panel"
import { UserHighlightCommand } from "@/components/graph/user-highlight-command"
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

const ESTIMATE_COMMIT_DELAY = 650
const ESTIMATE_BUFFER_MAX_DIGITS = 2

const { nodeWidth: NW, nodeHeight: NH } = LAYOUT_METRICS
const ORPHAN_TOP_GAP = 40
const ORPHAN_LABEL_HEIGHT = 34

function toggleKey(prev: ToggleKey[], key: ToggleKey): ToggleKey[] {
  return prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(
    target.closest("input, textarea, select, [contenteditable='true']")
  )
}

type Point = { x: number; y: number }

function dist(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/**
 * SVG path through a routed polyline (dagre's dummy-node waypoints),
 * with corners rounded. Handles bends of any angle, not just 90° —
 * dagre's bend points aren't always axis-aligned.
 */
function roundedPath(points: Point[], radius = 10) {
  if (points.length < 2) return ""
  if (points.length === 2) {
    return `M${points[0].x},${points[0].y} L${points[1].x},${points[1].y}`
  }
  let d = `M${points[0].x},${points[0].y}`
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const next = points[i + 1]
    const d1 = dist(prev, curr)
    const d2 = dist(curr, next)
    const r = Math.min(radius, d1 / 2, d2 / 2)
    const p1x = curr.x + ((prev.x - curr.x) / d1) * r
    const p1y = curr.y + ((prev.y - curr.y) / d1) * r
    const p2x = curr.x + ((next.x - curr.x) / d2) * r
    const p2y = curr.y + ((next.y - curr.y) / d2) * r
    d += ` L${p1x},${p1y} Q${curr.x},${curr.y} ${p2x},${p2y}`
  }
  const last = points[points.length - 1]
  d += ` L${last.x},${last.y}`
  return d
}

export function CycleGraph({ snapshot }: { snapshot: Snapshot }) {
  return (
    <IssueUpdatesProvider>
      <CycleGraphView snapshot={snapshot} />
    </IssueUpdatesProvider>
  )
}
function CycleGraphView({ snapshot }: { snapshot: Snapshot }) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const { state: location, update: updateLocation } = useGraphLocation(
    snapshot.cycle.id
  )
  const selected = location.selected
  const active = location.active
  const filters = location.filters
  const filtering = hasFilters(filters)
  const { mutate, notify } = useIssueUpdates()
  const [mobilePanelOpen, setMobilePanelOpen] = useState<boolean | null>(null)
  const [group, setGroup] = useState<Condition | null>(null)
  const [panelWidth, setPanelWidth] = useState(360)
  const [containerWidth, setContainerWidth] = useState(1200)
  const containerRef = useRef<HTMLDivElement>(null)
  const mobile = containerWidth < 768
  function setSelected(id: string | null) {
    updateLocation({ selected: id })
    if (id) {
      setPanelOpen(true)
      setMobilePanelOpen(true)
    }
  }
  function setActive(
    next: Visibility[] | ((prev: Visibility[]) => Visibility[])
  ) {
    updateLocation({ active: typeof next === "function" ? next(active) : next })
  }
  function setFilters(next: Filters) {
    updateLocation({ filters: next })
    setGroup(null)
  }
  const [hovered, setHovered] = useState<string | null>(null)
  const [view, setView] = useState({ k: 1, x: 0, y: 0 })
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  const [animating, setAnimating] = useState(false)
  const [panelOpen, setPanelOpen] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)
  const [userPaletteOpen, setUserPaletteOpen] = useState(false)
  const [highlightedUserId, setHighlightedUserId] = useState<string | null>(
    null
  )
  const [estimating, setEstimating] = useState<string | null>(null)
  const [estimateBuffer, setEstimateBuffer] = useState("")
  const [errorNode, setErrorNode] = useState<string | null>(null)
  const animTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )
  const estimateTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )
  const errorNodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  )

  const showOutside = active.includes("showOutside")
  const showParents = active.includes("showParents")

  const nodesById = useMemo(
    () => new Map(snapshot.nodes.map((n) => [n.id, n])),
    [snapshot]
  )
  const graph = useMemo(() => buildGraph(snapshot), [snapshot])
  const cycles = useMemo(() => detectCycles(graph), [graph])
  const layout = useMemo(() => {
    const selectedNode = selected ? nodesById.get(selected) : null
    if (!selectedNode || selectedNode.inCycle || showOutside)
      return layoutGraph(snapshot, { showOutside })
    const revealed = new Set([
      selectedNode.id,
      ...walk(selectedNode.id, graph.preds),
      ...walk(selectedNode.id, graph.succs),
    ])
    return layoutGraph(
      {
        ...snapshot,
        nodes: snapshot.nodes.map((node) =>
          revealed.has(node.id) ? { ...node, inCycle: true } : node
        ),
      },
      { showOutside: false }
    )
  }, [snapshot, showOutside, selected, nodesById, graph])
  const showOrphans =
    active.includes("showOrphans") ||
    filtering ||
    Boolean(selected && layout.orphans.includes(selected))
  const matchingIds = useMemo(
    () =>
      new Set(
        snapshot.nodes
          .filter(
            (node) =>
              !node.isEpic &&
              (node.inCycle || showOutside) &&
              matchesFilters(node, filters, graph)
          )
          .map((node) => node.id)
      ),
    [snapshot, showOutside, filters, graph]
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
    ? ORPHAN_TOP_GAP +
      ORPHAN_LABEL_HEIGHT +
      orphanRows * LAYOUT_METRICS.rowHeight
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

  const visibleOrphanPos = Object.fromEntries(
    Object.entries(orphanPos).filter(
      ([id]) => active.includes("showOrphans") || filtering || selected === id
    )
  )
  const selectedNode = selected ? (nodesById.get(selected) ?? null) : null
  const highlightedMember = highlightedUserId
    ? (snapshot.members ?? []).find((m) => m.id === highlightedUserId)
    : null

  const highlightedNodeIds = useMemo(() => {
    if (!highlightedUserId) return null
    return new Set(
      snapshot.nodes
        .filter((n) => n.assigneeId === highlightedUserId)
        .map((n) => n.id)
    )
  }, [snapshot, highlightedUserId])

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

  function focusSelected() {
    if (!selected) return
    const point = layout.pos[selected] ?? orphanPos[selected]
    const canvas = canvasRef.current
    if (!point || !canvas) return
    const k = Math.min(1.8, Math.max(0.85, view.k))
    animateTo({
      k,
      x: canvas.clientWidth / 2 - (point.x + NW / 2) * k,
      y: canvas.clientHeight / 2 - (point.y + NH / 2) * k,
    })
  }
  async function share(issue: boolean) {
    try {
      const params = new URLSearchParams(window.location.search)
      params.set("cycle", snapshot.cycle.id)
      if (!issue) params.delete("issue")
      const url = new URL(window.location.href)
      url.search = params.toString()
      await navigator.clipboard.writeText(url.toString())
      notify("Enlace copiado")
    } catch {
      notify(
        "No se pudo copiar el enlace. Copiá la dirección del navegador.",
        "error"
      )
    }
  }
  function selectGroup(next: Condition | null) {
    setGroup(next)
    if (next)
      updateLocation({
        selected: null,
        filters: { ...emptyFilters(), conditions: [next] },
      })
  }
  useEffect(() => {
    if (!selected) return
    const frame = requestAnimationFrame(() => {
      setPanelOpen(true)
      setMobilePanelOpen(true)
    })
    return () => cancelAnimationFrame(frame)
  }, [selected])
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(() =>
      setContainerWidth(container.clientWidth)
    )
    observer.observe(container)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    function frameView() {
      if (selected) focusSelected()
      else animateTo(centeredView(view.k, showOrphans ? orphanAreaHeight : 0))
    }
    const frame = requestAnimationFrame(frameView)
    const observer = new ResizeObserver(frameView)
    observer.observe(canvas)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, layout, panelOpen, mobile, showOrphans])

  function cancelEstimate() {
    clearTimeout(estimateTimeoutRef.current)
    setEstimating(null)
    setEstimateBuffer("")
  }

  function commitEstimate(id: string, buffer: string) {
    clearTimeout(estimateTimeoutRef.current)
    setEstimating(null)
    setEstimateBuffer("")
    if (!buffer.length) return
    const estimate = Number(buffer)
    mutate(id, { estimate }).catch(() => {
      clearTimeout(errorNodeTimeoutRef.current)
      setErrorNode(id)
      errorNodeTimeoutRef.current = setTimeout(() => setErrorNode(null), 1600)
    })
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (estimating) {
        if (isTypingTarget(e.target)) return
        if (e.key === "Escape") {
          e.preventDefault()
          cancelEstimate()
          return
        }
        if (e.key === "Enter") {
          e.preventDefault()
          if (estimateBuffer.length) commitEstimate(estimating, estimateBuffer)
          else cancelEstimate()
          return
        }
        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault()
          const next = (estimateBuffer + e.key).slice(
            0,
            ESTIMATE_BUFFER_MAX_DIGITS
          )
          setEstimateBuffer(next)
          clearTimeout(estimateTimeoutRef.current)
          estimateTimeoutRef.current = setTimeout(
            () => commitEstimate(estimating, next),
            ESTIMATE_COMMIT_DELAY
          )
          return
        }
        cancelEstimate()
      }

      if (searchOpen || userPaletteOpen || isTypingTarget(e.target)) return
      if (e.key === "Escape") {
        if (selected) {
          setSelected(null)
          return
        }
        if (highlightedUserId) {
          setHighlightedUserId(null)
          return
        }
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setSearchOpen((v) => !v)
        return
      }
      if (searchOpen || userPaletteOpen || isTypingTarget(e.target)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === "1") {
        setActive((prev) => toggleKey(prev, "showOutside"))
      } else if (e.key === "2") {
        setActive((prev) => toggleKey(prev, "showParents"))
      } else if (e.key === "3") {
        setActive((prev) => toggleKey(prev, "showOrphans"))
      } else if (e.key.toLowerCase() === "r") {
        setSelected(null)
        animateTo(centeredView(1, showOrphans ? orphanAreaHeight : 0))
      } else if (e.key.toLowerCase() === "e") {
        const target = hovered ?? selected
        if (target && !nodesById.get(target)?.isEpic) {
          e.preventDefault()
          setEstimating(target)
          setEstimateBuffer("")
        }
      } else if (e.key.toLowerCase() === "u") {
        e.preventDefault()
        setUserPaletteOpen(true)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    searchOpen,
    userPaletteOpen,
    showOrphans,
    orphanAreaHeight,
    hovered,
    selected,
    estimating,
    estimateBuffer,
    highlightedUserId,
  ])

  function handleCanvasMouseDown(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("[data-node-id]")) return
    setDrag({ x: e.clientX - view.x, y: e.clientY - view.y })
  }
  function handleCanvasMouseMove(e: React.MouseEvent) {
    if (!drag) return
    setView((v) => ({ ...v, x: e.clientX - drag.x, y: e.clientY - drag.y }))
  }
  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      setView((v) => ({
        ...v,
        k: Math.min(1.8, Math.max(0.45, v.k - e.deltaY * 0.0016)),
      }))
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [])

  const Panel =
    selected && (!selectedNode || selectedNode.isEpic)
      ? RemoteIssuePanel
      : SidePanel
  const panel = (
    <Panel
      key={selected ?? "summary"}
      issueId={selected ?? ""}
      snapshot={snapshot}
      selected={selectedNode}
      nodesById={nodesById}
      graph={graph}
      chain={chain}
      bottlenecksList={bottlenecksList}
      stranded={strandedList}
      openBlocksList={openBlocksList}
      analysis={snapshot.analysis}
      workspace={snapshot.cycle.workspace}
      cycle={snapshot.cycle}
      states={snapshot.states ?? []}
      members={snapshot.members ?? []}
      onSelect={setSelected}
      onBack={() => {
        setSelected(null)
        setGroup(null)
      }}
      onHover={setHovered}
      onFocus={selectedNode?.isEpic ? undefined : focusSelected}
      onShareIssue={() => {
        void share(true)
      }}
      group={group}
      onGroup={selectGroup}
    />
  )

  return (
    <div ref={containerRef} className="flex h-full flex-col">
      <CycleHeader cycle={snapshot.cycle} nodes={snapshot.nodes} />
      <ToggleBar
        active={active}
        onToggle={setActive}
        onReset={() => {
          setSelected(null)
          animateTo(centeredView(1, showOrphans ? orphanAreaHeight : 0))
        }}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenUserPalette={() => setUserPaletteOpen(true)}
        highlightedUserName={highlightedMember?.name}
        onClearHighlight={() => setHighlightedUserId(null)}
        filters={
          <FilterBar
            filters={filters}
            onChange={setFilters}
            members={snapshot.members ?? []}
            states={snapshot.states ?? []}
          />
        }
        count={matchingIds.size}
        total={
          snapshot.nodes.filter(
            (node) => !node.isEpic && (node.inCycle || showOutside)
          ).length
        }
        onShare={() => {
          void share(false)
        }}
        panelOpen={mobile ? (mobilePanelOpen ?? Boolean(selected)) : panelOpen}
        onTogglePanel={() => {
          if (mobile)
            setMobilePanelOpen(!(mobilePanelOpen ?? Boolean(selected)))
          else setPanelOpen((open) => !open)
        }}
      />
      <ActiveFilters
        filters={filters}
        onChange={setFilters}
        members={snapshot.members ?? []}
        states={snapshot.states ?? []}
      />
      {location.cycle && location.cycle !== snapshot.cycle.id && (
        <Alert>
          <AlertDescription>
            El ciclo del enlace cambió. Estás viendo los datos del ciclo actual.
          </AlertDescription>
        </Alert>
      )}
      {selectedNode &&
        !selectedNode.isEpic &&
        ((!selectedNode.inCycle && !showOutside) ||
          (filtering && !matchingIds.has(selectedNode.id)) ||
          (!active.includes("showOrphans") &&
            Boolean(orphanPos[selectedNode.id]))) && (
          <Alert>
            <AlertDescription>
              Mostrando issue seleccionada fuera de los filtros.
            </AlertDescription>
          </Alert>
        )}
      {filtering && matchingIds.size === 0 && (
        <Alert>
          <AlertDescription>
            No hay issues que coincidan.{" "}
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setFilters(emptyFilters())}
            >
              Limpiar filtros
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <EmptyCycleError cycles={cycles} />
      <div className="flex min-h-0 flex-1">
        <div
          ref={canvasRef}
          className="relative min-w-0 flex-1 cursor-grab overflow-hidden bg-[radial-gradient(circle,color-mix(in_oklch,var(--foreground)_14%,transparent)_1px,transparent_1px)] bg-size-[20px_20px] bg-position-[0_0] active:cursor-grabbing"
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={() => setDrag(null)}
          onMouseLeave={() => setDrag(null)}
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
              <clipPath id="node-clip">
                <rect width={NW} height={NH} rx={6} />
              </clipPath>
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

              {layout.edges
                .map(([a, b]) => {
                  const on =
                    !highlightedNodeIds && lit && lit.has(a) && lit.has(b)
                  const off = highlightedNodeIds ? true : lit && !on
                  const blocker = nodesById.get(a)
                  const openEdge =
                    blocker?.type !== "completed" &&
                    blocker?.type !== "canceled"
                  const stroke = on
                    ? "var(--foreground)"
                    : off
                      ? "var(--border)"
                      : openEdge
                        ? "var(--status-stop)"
                        : "var(--muted-foreground)"
                  const points = layout.edgeRoutes[`${a}|${b}`] ?? [
                    layout.pos[a],
                    layout.pos[b],
                  ]
                  return { a, b, on, off, openEdge, stroke, points }
                })
                .sort((x, y) => Number(x.on) - Number(y.on))
                .map(({ a, b, on, off, openEdge, stroke, points }) => (
                  <path
                    key={`${a}|${b}`}
                    d={roundedPath(points)}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={on ? 1.8 : openEdge && !off ? 1.3 : 1}
                    opacity={highlightedNodeIds ? 0.25 : off ? 0.6 : 1}
                    markerEnd="url(#edge-arrow)"
                  />
                ))}

              {Object.entries({
                ...layout.pos,
                ...(showOrphans ? visibleOrphanPos : {}),
              }).map(([id, p]) => {
                const n = nodesById.get(id)
                if (!n) return null
                const on = !lit || lit.has(id)
                const isSelected = selected === id
                const isHovered = hovered === id
                const userMatch = highlightedNodeIds?.has(id) ?? false
                const blocked = (layout.preds[id] ?? []).some((x) => {
                  const node = nodesById.get(x)
                  return (
                    node &&
                    node.type !== "completed" &&
                    node.type !== "canceled"
                  )
                })
                const downCount = (layout.succs[id] ?? []).length
                const openBlocker =
                  downCount > 0 &&
                  n.type !== "completed" &&
                  n.type !== "canceled"

                return (
                  <g
                    key={id}
                    data-node-id={id}
                    transform={`translate(${p.x},${p.y})`}
                    opacity={
                      isSelected
                        ? 1
                        : filtering && !matchingIds.has(id)
                          ? 0.14
                          : highlightedNodeIds
                            ? userMatch
                              ? 1
                              : 0.14
                            : on
                              ? 1
                              : 0.16
                    }
                    className="cursor-pointer"
                    role="button"
                    tabIndex={0}
                    aria-label={`${n.id}: ${n.title}`}
                    aria-pressed={isSelected}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        setSelected(selected === id ? null : id)
                      }
                    }}
                    onMouseEnter={() => setHovered(id)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => {
                      setSelected(selected === id ? null : id)
                      setPanelOpen(true)
                    }}
                  >
                    {showParents && n.parent && (
                      <text
                        x={3}
                        y={-7}
                        className="fill-muted-foreground text-[9px]"
                      >
                        <title>{n.parentTitle ?? n.parent}</title>
                        {(n.parentTitle ?? n.parent).slice(0, 36)}
                      </text>
                    )}
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
                        className="animate-node-highlight pointer-events-none"
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
                            : userMatch
                              ? "var(--primary)"
                              : blocked
                                ? "color-mix(in oklch, var(--status-stop) 35%, var(--border))"
                                : "var(--border)"
                      }
                      strokeWidth={
                        isSelected || isHovered || userMatch ? 1.6 : 1
                      }
                      strokeDasharray={n.inCycle ? undefined : "3 3"}
                    />
                    <rect
                      width={4}
                      height={NH}
                      fill={statusColorVar(n)}
                      clipPath="url(#node-clip)"
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

              {showOrphans && orphans.length > 0 && (
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
                </g>
              )}

              {(() => {
                const badgeNode = estimating ?? errorNode
                if (!badgeNode) return null
                const p = layout.pos[badgeNode] ?? orphanPos[badgeNode]
                if (!p) return null
                const isError = !estimating && errorNode === badgeNode
                return (
                  <g
                    transform={`translate(${p.x + NW / 2},${p.y - 12})`}
                    className="pointer-events-none"
                  >
                    <rect
                      x={-22}
                      y={-13}
                      width={44}
                      height={20}
                      rx={6}
                      fill={
                        isError ? "var(--status-stop)" : "var(--foreground)"
                      }
                    />
                    <text
                      x={0}
                      y={1}
                      textAnchor="middle"
                      className="text-[11px] font-semibold"
                      fill="var(--background)"
                    >
                      {isError ? "error" : `${estimateBuffer || "…"} pt`}
                    </text>
                  </g>
                )
              })()}
            </g>
          </svg>
          <StatusLegend />
        </div>
        {panelOpen && !mobile && (
          <aside
            id="cycle-side-panel"
            style={{ width: Math.min(panelWidth, containerWidth * 0.6) }}
            className="relative min-h-0 shrink-0 border-l bg-background"
          >
            <div
              role="separator"
              aria-label="Ancho del panel"
              aria-orientation="vertical"
              tabIndex={0}
              aria-valuemin={320}
              aria-valuemax={Math.floor(containerWidth * 0.6)}
              aria-valuenow={Math.min(panelWidth, containerWidth * 0.6)}
              className="absolute inset-y-0 -left-1 w-2 cursor-col-resize touch-none outline-none after:absolute after:inset-y-0 after:left-1 after:w-px after:bg-transparent hover:after:bg-ring focus-visible:after:bg-ring"
              onKeyDown={(event) => {
                event.stopPropagation()
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  event.preventDefault()
                  setPanelWidth((width) =>
                    Math.min(
                      containerWidth * 0.6,
                      Math.max(
                        320,
                        width + (event.key === "ArrowLeft" ? 24 : -24)
                      )
                    )
                  )
                }
              }}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId)
              }}
              onPointerMove={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  const right =
                    containerRef.current?.getBoundingClientRect().right ?? 0
                  setPanelWidth(
                    Math.min(
                      containerWidth * 0.6,
                      Math.max(320, right - event.clientX)
                    )
                  )
                }
              }}
              onPointerUp={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId))
                  event.currentTarget.releasePointerCapture(event.pointerId)
              }}
            />
            {panel}
          </aside>
        )}
        {mobile && (
          <Sheet
            open={mobilePanelOpen ?? Boolean(selected)}
            onOpenChange={setMobilePanelOpen}
          >
            <SheetContent
              id="mobile-cycle-side-panel"
              className="w-full sm:max-w-none"
              aria-describedby="mobile-panel-description"
            >
              <SheetTitle className="sr-only">
                {selectedNode?.title ?? selected ?? "Acciones del ciclo"}
              </SheetTitle>
              <SheetDescription
                id="mobile-panel-description"
                className="sr-only"
              >
                Detalle de issues y acciones del ciclo.
              </SheetDescription>
              <div className="min-h-0 flex-1 pt-9">{panel}</div>
            </SheetContent>
          </Sheet>
        )}
      </div>
      <IssueSearchCommand
        open={searchOpen}
        onOpenChange={setSearchOpen}
        cycle={snapshot.cycle}
        nodes={snapshot.nodes}
        onSelectIssue={setSelected}
      />
      <UserHighlightCommand
        open={userPaletteOpen}
        onOpenChange={setUserPaletteOpen}
        members={snapshot.members ?? []}
        highlightedUserId={highlightedUserId}
        onSelect={setHighlightedUserId}
      />
    </div>
  )
}
