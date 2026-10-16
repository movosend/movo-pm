"use client"
import { useEffect, useId, useRef, useState } from "react"
import { FilesIcon, ImageOffIcon } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { statusColorVar } from "@/components/graph/status-color"
import type { StagePreview } from "@/lib/planning/preview"
import { PLANNING_CARD } from "@/lib/planning/layout"
import { planningRequest } from "./api"

// A gallery must not request every sheet's Linear graph at once.
const pending: Array<() => Promise<void>> = []
let active = 0
function drain() {
  while (active < 2 && pending.length) {
    const job = pending.shift()!
    active++
    void job().finally(() => {
      active--
      drain()
    })
  }
}

export function StageThumbnail({ stageId }: { stageId: string }) {
  const container = useRef<HTMLDivElement>(null)
  const marker = useId().replaceAll(":", "")
  const [preview, setPreview] = useState<StagePreview | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let canceled = false
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        pending.push(async () => {
          if (canceled) return
          try {
            const result = await planningRequest<StagePreview>(
              `/api/planning/${stageId}/preview`
            )
            if (!canceled) setPreview(result)
          } catch {
            if (!canceled) setError(true)
          }
        })
        drain()
      },
      { rootMargin: "100px" }
    )
    if (container.current) observer.observe(container.current)
    return () => {
      canceled = true
      observer.disconnect()
    }
  }, [stageId])
  return (
    <div
      ref={container}
      className="relative flex aspect-[5/4] items-center justify-center overflow-hidden rounded-lg border bg-muted/20"
    >
      {!preview && !error ? (
        <Skeleton className="absolute inset-3 rounded-md" />
      ) : error ? (
        <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
          <ImageOffIcon className="size-5" />
          <span>Vista previa no disponible</span>
          <span>Podés abrir la hoja igualmente</span>
        </div>
      ) : preview && !preview.nodes.length ? (
        <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
          <FilesIcon className="size-6" />
          <span>Hoja vacía · agregá tu primera US</span>
        </div>
      ) : (
        preview && (
          <svg
            className="size-full p-3 transition-transform duration-200 group-hover:scale-[1.02] motion-reduce:transition-none"
            viewBox={`0 0 ${preview.width} ${preview.height}`}
            role="img"
            aria-label={`Vista previa del canvas: ${preview.count} US en el plan`}
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
            {preview.edges.map((edge) => (
              <polyline
                key={edge.id}
                points={edge.points.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="var(--muted-foreground)"
                strokeWidth={2}
                opacity={0.55}
                strokeDasharray={edge.suggested ? "5 5" : undefined}
                markerEnd={`url(#${marker})`}
              />
            ))}
            {preview.nodes.map((node) => (
              <g key={node.id}>
                <rect
                  x={node.x}
                  y={node.y}
                  width={PLANNING_CARD.nodeWidth}
                  height={PLANNING_CARD.nodeHeight}
                  rx={8}
                  fill={node.included ? "var(--accent)" : "var(--background)"}
                  stroke={
                    node.included ? "var(--primary)" : "var(--muted-foreground)"
                  }
                  strokeOpacity={0.45}
                  strokeWidth={2}
                  strokeDasharray={node.included ? undefined : "5 4"}
                />
                <circle
                  cx={node.x + 16}
                  cy={node.y + 23}
                  r={4}
                  fill={statusColorVar(node)}
                />
                <text
                  x={node.x + 28}
                  y={node.y + 27}
                  fontSize={12}
                  fill="var(--muted-foreground)"
                >
                  {node.id}
                </text>
                <text
                  x={node.x + 12}
                  y={node.y + 51}
                  fontSize={13}
                  fill="var(--foreground)"
                >
                  {node.short.length > 28
                    ? `${node.short.slice(0, 27)}…`
                    : node.short}
                </text>
                <text
                  x={node.x + 12}
                  y={node.y + 73}
                  fontSize={10}
                  fill="var(--muted-foreground)"
                >
                  {node.included ? "En el plan" : "Sugerida"}
                </text>
              </g>
            ))}
          </svg>
        )
      )}
      {preview && (
        <span className="absolute right-2 bottom-2 rounded bg-background/90 px-2 py-1 text-[10px] text-muted-foreground">
          {preview.count} US en el plan
        </span>
      )}
    </div>
  )
}
