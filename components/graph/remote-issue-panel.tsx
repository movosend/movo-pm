"use client"

import { useEffect, useState } from "react"
import { ArrowLeftIcon, Loader2Icon } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { SidePanel, type PanelProps } from "@/components/graph/side-panel"
import { useIssueUpdates } from "@/components/graph/issue-updates"
import { buildGraph } from "@/lib/graph/build"
import type { IssueDetail, Snapshot } from "@/lib/schema/snapshot"

export function RemoteIssuePanel({
  issueId,
  snapshot,
  ...props
}: PanelProps & {
  issueId: string
  snapshot: Snapshot
}) {
  const [detail, setDetail] = useState<IssueDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const { busy } = useIssueUpdates()
  const updating = busy.has(issueId)

  useEffect(() => {
    if (updating) return
    const controller = new AbortController()
    fetch(
      `/api/issues/${encodeURIComponent(issueId)}?cycle=${encodeURIComponent(snapshot.cycle.id)}`,
      {
        signal: controller.signal,
      }
    )
      .then(async (response) => {
        if (!response.ok)
          throw new Error("No se pudo cargar la issue desde Linear.")
        const body: IssueDetail = await response.json()
        if (!body.nodes.some((node) => node.id === issueId))
          throw new Error("No se encontró la issue en Linear.")
        if (!controller.signal.aborted) {
          setDetail(body)
          setError(null)
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason.message)
      })
    return () => controller.abort()
  }, [issueId, snapshot, attempt, updating])

  if (!detail || error)
    return (
      <div className="flex flex-col gap-4 p-4">
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={props.onBack}
        >
          <ArrowLeftIcon data-icon="inline-start" /> Volver al resumen
        </Button>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>
              {error}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setError(null)
                  setAttempt((value) => value + 1)
                }}
              >
                Reintentar
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <p
            role="status"
            className="flex items-center gap-2 text-xs text-muted-foreground"
          >
            <Loader2Icon className="size-4 animate-spin" /> Cargando {issueId}…
          </p>
        )}
      </div>
    )

  const nodesById = new Map(props.nodesById)
  detail.nodes.forEach((node) => nodesById.set(node.id, node))
  const selected = nodesById.get(issueId) ?? null
  const graph = buildGraph({
    ...snapshot,
    nodes: [...nodesById.values()],
    blocks: [...snapshot.blocks, ...detail.blocks],
  })
  return (
    <SidePanel
      {...props}
      selected={selected}
      nodesById={nodesById}
      graph={graph}
      states={detail.states}
      members={detail.members}
      onFocus={undefined}
    />
  )
}
