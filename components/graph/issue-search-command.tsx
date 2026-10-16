"use client"

import { useEffect, useRef, useState } from "react"

import {
  ArrowLeftIcon,
  ExternalLinkIcon,
  Loader2Icon,
  PlusIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { statusColorVar, statusTextVar } from "@/components/graph/status-color"
import { useIssueUpdates } from "@/components/graph/issue-updates"
import type { Cycle, Node, SearchIssue } from "@/lib/schema/snapshot"

export function IssueSearchCommand({
  open,
  onOpenChange,
  cycle,
  nodes,
  onSelectIssue,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cycle: Cycle
  nodes: Node[]
  onSelectIssue: (id: string) => void
}) {
  const { mutate, busy } = useIssueUpdates()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchIssue[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<SearchIssue | null>(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  function handleOpenChange(next: boolean) {
    if (!next) {
      setQuery("")
      setResults([])
      setSelected(null)
      setError(null)
    }
    onOpenChange(next)
  }

  const term = query.trim()
  const localResults: SearchIssue[] =
    term.length >= 2
      ? nodes
          .filter((node) =>
            `${node.id} ${node.title}`
              .toLowerCase()
              .includes(term.toLowerCase())
          )
          .map((node) => ({
            ...node,
            url: `https://linear.app/${cycle.workspace}/issue/${node.id}`,
            cycleId: node.inCycle ? cycle.id : null,
          }))
      : []
  const localIds = new Set(localResults.map((issue) => issue.id))
  const visibleResults =
    term.length >= 2
      ? [...localResults, ...results.filter((issue) => !localIds.has(issue.id))]
      : []

  function handleSelect(issue: SearchIssue) {
    if (nodes.some((node) => node.id === issue.id)) {
      handleOpenChange(false)
      onSelectIssue(issue.id)
    } else {
      setSelected(issue)
    }
  }

  useEffect(() => {
    if (!open || selected || term.length < 2) return

    let canceled = false
    const timer = setTimeout(() => {
      setLoading(true)
      setError(null)
      setResults([])
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      fetch(`/api/issues/search?q=${encodeURIComponent(term)}`, {
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error("search failed")
          return res.json()
        })
        .then((body) => {
          if (!canceled) setResults(body.results ?? [])
        })
        .catch((err) => {
          if (!canceled && err.name !== "AbortError") {
            setError("No se pudo buscar en Linear.")
          }
        })
        .finally(() => {
          if (!canceled) setLoading(false)
        })
    }, 250)

    return () => {
      canceled = true
      clearTimeout(timer)
      abortRef.current?.abort()
    }
  }, [term, selected, open])

  function handleAdd(issue: SearchIssue) {
    setError(null)
    setAdding(true)
    mutate(issue.id, { cycleId: cycle.id })
      .then(() => {
        handleOpenChange(false)
      })
      .catch((err) => setError(err.message))
      .finally(() => setAdding(false))
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Buscar issues"
      description="Buscá por título o código para ver el detalle de una issue o agregarla al ciclo."
    >
      <Command shouldFilter={false}>
        {selected ? (
          <div className="p-3">
            <Button
              variant="ghost"
              size="sm"
              className="mb-2.5 -ml-2 text-muted-foreground"
              onClick={() => setSelected(null)}
            >
              <ArrowLeftIcon data-icon="inline-start" />
              Volver a la búsqueda
            </Button>
            <div className="text-[11.5px] font-semibold text-muted-foreground">
              {selected.id}
            </div>
            <div className="mb-3 text-[15px] leading-snug font-semibold tracking-tight">
              {selected.title}
            </div>
            <dl className="mb-4 flex flex-col text-[12.5px]">
              <div className="flex items-center justify-between gap-3 border-b py-1.5">
                <dt className="text-muted-foreground">Estado</dt>
                <dd
                  className="text-xs font-semibold"
                  style={{ color: statusTextVar(selected) }}
                >
                  {selected.status}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-b py-1.5">
                <dt className="text-muted-foreground">Responsable</dt>
                <dd>{selected.who ?? "sin asignar"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-1.5">
                <dt className="text-muted-foreground">Linear</dt>
                <dd>
                  <a
                    href={selected.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    abrir
                    <ExternalLinkIcon className="size-3" />
                  </a>
                </dd>
              </div>
            </dl>

            {selected.cycleId === cycle.id ? (
              <p className="text-xs text-muted-foreground">
                Ya está en este ciclo.
              </p>
            ) : (
              <Button
                size="sm"
                variant="default"
                onClick={() => handleAdd(selected)}
                disabled={adding || busy.has(selected.id)}
                className="w-full"
              >
                {adding ? (
                  <Loader2Icon
                    data-icon="inline-start"
                    className="animate-spin"
                  />
                ) : (
                  <PlusIcon data-icon="inline-start" />
                )}
                Agregar al Ciclo {cycle.number + 1}
              </Button>
            )}
            {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
          </div>
        ) : (
          <>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Buscar por título o código (ej. MOVO-123)…"
            />
            <CommandList>
              {loading && (
                <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
                  <Loader2Icon className="size-3.5 animate-spin" />
                  Buscando…
                </div>
              )}
              {!loading && term.length < 2 && (
                <CommandEmpty>Escribí al menos 2 caracteres.</CommandEmpty>
              )}
              {!loading && term.length >= 2 && visibleResults.length === 0 && (
                <CommandEmpty>Sin resultados en Linear.</CommandEmpty>
              )}
              <CommandGroup>
                {visibleResults.map((issue) => (
                  <CommandItem
                    key={issue.id}
                    value={issue.id}
                    onSelect={() => handleSelect(issue)}
                    className="flex items-center gap-2.5"
                  >
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ background: statusColorVar(issue) }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs">
                        {issue.short}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {issue.id} · {issue.status}
                        {issue.cycleId === cycle.id ? " · en este ciclo" : ""}
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            {error && (
              <p className="px-3 pb-2 text-xs text-destructive">{error}</p>
            )}
          </>
        )}
      </Command>
    </CommandDialog>
  )
}
