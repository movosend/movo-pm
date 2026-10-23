"use client"

import { useEffect, useState } from "react"
import { Loader2Icon } from "lucide-react"
import { CycleGraph } from "@/components/graph/cycle-graph"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import type { Snapshot } from "@/lib/schema/snapshot"
import type { TeamGraphPage } from "@/lib/schema/team-issues"
import { scopedApiUrl } from "@/lib/workspaces/routes"

export function TeamIssuesGraph() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loaded, setLoaded] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    async function load() {
      setLoading(true)
      setLoaded(0)
      setError(null)
      const nodes = new Map<string, TeamGraphPage["nodes"][number]>()
      const edges = new Set<string>()
      const seen = new Set<string>()
      let firstPage: TeamGraphPage | null = null
      let cursor: string | null = null
      try {
        do {
          const path = `/api/issues/all${cursor ? `?after=${encodeURIComponent(cursor)}` : ""}`
          const response = await fetch(scopedApiUrl(path), {
            cache: "no-store",
            signal: controller.signal,
          })
          const page = (await response.json()) as TeamGraphPage & {
            error?: string
          }
          if (!response.ok)
            throw new Error(page.error ?? "No se pudo cargar el grafo.")
          if (!active) return
          firstPage ??= page
          page.nodes.forEach((node) => nodes.set(node.id, node))
          page.blocks.forEach(([a, b]) => edges.add(`${a}|${b}`))
          setLoaded(nodes.size)
          cursor = page.nextCursor
          if (cursor && seen.has(cursor))
            throw new Error("Linear devolvió una página repetida.")
          if (cursor) seen.add(cursor)
        } while (cursor && active)
        if (!active || !firstPage) return
        const blocks = [...edges]
          .map((edge) => edge.split("|") as [string, string])
          .filter(([a, b]) => nodes.has(a) && nodes.has(b))
        setSnapshot({
          cycle: firstPage.cycle,
          nodes: [...nodes.values()],
          blocks,
          states: firstPage.states,
          members: firstPage.members,
          analysis: null,
        })
      } catch (reason) {
        if (active && !controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "No se pudo cargar el grafo."
          )
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
      controller.abort()
    }
  }, [revision])

  if (error && !snapshot)
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription className="flex flex-wrap items-center gap-3">
            {error}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRevision((value) => value + 1)}
            >
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )

  if (!snapshot)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <Loader2Icon
          className="size-6 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
        <p className="text-sm font-medium">Armando el grafo de dependencias…</p>
        <p className="text-xs text-muted-foreground" role="status">
          {loading ? `${loaded} issues cargados de Linear` : ""}
        </p>
      </div>
    )

  return (
    <div className="relative h-full">
      <CycleGraph
        snapshot={snapshot}
        allIssues
        onRefresh={() => setRevision((value) => value + 1)}
      />
      {error && (
        <Alert
          variant="destructive"
          className="absolute top-2 left-2 z-20 max-w-lg shadow-lg"
        >
          <AlertDescription className="flex flex-wrap items-center gap-3">
            {error}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRevision((value) => value + 1)}
            >
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
