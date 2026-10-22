"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowUpRightIcon, RotateCwIcon, SearchIcon } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { TeamIssue, TeamIssuePage } from "@/lib/schema/team-issues"
import { scopedApiUrl } from "@/lib/workspaces/routes"
import { cn } from "@/lib/utils"

const filters = [
  { id: "all", label: "Todos" },
  { id: "pending", label: "Por hacer" },
  { id: "started", label: "En progreso" },
  { id: "completed", label: "Terminados" },
  { id: "canceled", label: "Cancelados" },
] as const

type Filter = (typeof filters)[number]["id"]

function matchesFilter(issue: TeamIssue, filter: Filter) {
  if (filter === "all") return true
  const type = issue.state?.type
  if (filter === "pending")
    return type === "triage" || type === "backlog" || type === "unstarted"
  return type === filter
}

function issueDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value))
}

export function TeamIssuesView() {
  const [issues, setIssues] = useState<TeamIssue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<Filter>("all")

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    async function load() {
      setIssues([])
      setLoading(true)
      setError(null)
      let cursor: string | null = null
      const seen = new Set<string>()
      try {
        do {
          const path = `/api/issues/all${cursor ? `?after=${encodeURIComponent(cursor)}` : ""}`
          const response = await fetch(scopedApiUrl(path), {
            cache: "no-store",
            signal: controller.signal,
          })
          const page = (await response.json()) as TeamIssuePage & {
            error?: string
          }
          if (!response.ok)
            throw new Error(page.error ?? "No se pudieron cargar los issues.")
          if (!active) return
          setIssues((current) => [...current, ...page.issues])
          cursor = page.nextCursor
          if (cursor && seen.has(cursor))
            throw new Error("Linear devolvió una página repetida.")
          if (cursor) seen.add(cursor)
        } while (cursor && active)
      } catch (reason) {
        if (active && !controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "No se pudieron cargar los issues."
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

  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase()
    return issues.filter(
      (issue) =>
        matchesFilter(issue, filter) &&
        (!term ||
          [
            issue.identifier,
            issue.title,
            issue.assignee?.displayName,
            issue.cycle?.name,
          ].some((value) => value?.toLocaleLowerCase().includes(term)))
    )
  }, [issues, query, filter])

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Todos los issues
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Todos los ciclos y el backlog del equipo seleccionado.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRevision((value) => value + 1)}
            disabled={loading}
          >
            <RotateCwIcon data-icon="inline-start" />
            Actualizar
          </Button>
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-sm">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Buscar issues"
              placeholder="Buscar por título, ID, persona o ciclo"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-8"
            />
          </div>
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {loading
              ? `Cargando… ${issues.length}`
              : `${visible.length} de ${issues.length} issues`}
          </span>
        </div>

        <div
          className="mb-4 flex flex-wrap gap-1"
          role="group"
          aria-label="Filtrar por estado"
        >
          {filters.map((option) => (
            <Button
              key={option.id}
              size="sm"
              variant={filter === option.id ? "secondary" : "ghost"}
              aria-pressed={filter === option.id}
              onClick={() => setFilter(option.id)}
            >
              {option.label}
            </Button>
          ))}
        </div>

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>
              {error} Podés intentar actualizar la lista.
            </AlertDescription>
          </Alert>
        )}

        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-175 text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="w-30 px-4 py-3 font-medium">
                  ID
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Issue
                </th>
                <th scope="col" className="w-40 px-4 py-3 font-medium">
                  Estado
                </th>
                <th scope="col" className="w-40 px-4 py-3 font-medium">
                  Responsable
                </th>
                <th scope="col" className="w-36 px-4 py-3 font-medium">
                  Ciclo
                </th>
                <th scope="col" className="w-32 px-4 py-3 font-medium">
                  Actualizado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {visible.map((issue) => (
                <tr key={issue.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {issue.identifier}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    <a
                      href={issue.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      {issue.title}
                      <ArrowUpRightIcon
                        className="size-3.5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="secondary"
                      className={cn(
                        issue.state?.type === "completed" &&
                          "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                        issue.state?.type === "canceled" &&
                          "text-muted-foreground"
                      )}
                    >
                      {issue.state?.name ?? "Sin estado"}
                    </Badge>
                    {issue.archivedAt && (
                      <Badge variant="outline" className="ml-1">
                        Archivado
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {issue.assignee?.displayName ?? "Sin asignar"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {issue.cycle?.name ??
                      (issue.cycle ? `Ciclo ${issue.cycle.number}` : "Backlog")}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {issueDate(issue.updatedAt)}
                  </td>
                </tr>
              ))}
              {!visible.length && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    {loading
                      ? "Cargando issues…"
                      : "No hay issues para este filtro."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
