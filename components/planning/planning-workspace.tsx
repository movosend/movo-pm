"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArchiveIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  CopyIcon,
  LinkIcon,
  Loader2Icon,
  PanelRightIcon,
  PencilIcon,
  RefreshCwIcon,
  PlusIcon,
  Undo2Icon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  IssueUpdatesProvider,
  useIssueUpdates,
} from "@/components/graph/issue-updates"
import { SidePanel } from "@/components/graph/side-panel"
import { IssueSearchCommand } from "@/components/graph/issue-search-command"
import { planPoints } from "@/lib/planning/forecast"
import { planningGraph } from "@/lib/planning/graph"
import { buildGraph } from "@/lib/graph/build"
import type { Cycle, IssueDetail, Node, Snapshot } from "@/lib/schema/snapshot"
import {
  isPending,
  type MembershipChange,
  type PlanningCycle,
  type Stage,
  type StageItem,
  type Transfer,
} from "@/lib/planning/types"
import { planningRequest } from "./api"
import { PlanCapacity } from "./plan-capacity"
import { DependencyDialog } from "./dependency-dialog"
import { PlanningCanvas } from "./planning-canvas"
import { TransferDialog } from "./transfer-dialog"

type StageData = {
  stage: Stage
  items: StageItem[]
  cycles: PlanningCycle[]
  transfers: Transfer[]
}
export function PlanningWorkspace({ stageId }: { stageId: string }) {
  return (
    <IssueUpdatesProvider>
      <Workspace key={stageId} stageId={stageId} />
    </IssueUpdatesProvider>
  )
}
function Workspace({ stageId }: { stageId: string }) {
  const router = useRouter()
  const { notify, busy: issueBusy } = useIssueUpdates()
  const url = `/api/planning/${stageId}`
  const [data, setData] = useState<StageData | null>(null)
  const [details, setDetails] = useState<Record<string, IssueDetail>>({})
  const [failures, setFailures] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [search, setSearch] = useState(false)
  const [dependencyOpen, setDependencyOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [running, setRunning] = useState<string | null>(null)
  const [undo, setUndo] = useState<MembershipChange[] | null>(null)
  const [rename, setRename] = useState(false)
  const [name, setName] = useState("")
  const [transferOpen, setTransferOpen] = useState(false)
  const [resolved, setResolved] = useState(false)
  const [summaryFilter, setSummaryFilter] = useState<
    "all" | "unestimated" | "blockers" | null
  >(null)
  const [panelPreference, setPanelOpen] = useState<boolean | null>(null)
  const [mobile, setMobile] = useState(false)
  const panelOpen = panelPreference ?? (!mobile || Boolean(selected))
  const [focusRequest, setFocusRequest] = useState(0)
  const detailsRef = useRef(details)
  const dataRef = useRef(data)
  const requests = useRef(new Map<string, Promise<void>>())
  const generation = useRef(0)
  const mounted = useRef(true)
  useEffect(() => {
    detailsRef.current = details
    dataRef.current = data
  }, [details, data])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const refresh = useCallback(async () => {
    const result = await planningRequest<StageData>(url)
    if (mounted.current) {
      setData(result)
      dataRef.current = result
    }
    return result
  }, [url])
  const loadDetail = useCallback((id: string, force = false): Promise<void> => {
    if (!force && detailsRef.current[id]) return Promise.resolve()
    const key = `${generation.current}:${id}`
    if (requests.current.has(key)) return requests.current.get(key)!
    const epoch = generation.current
    const stableId =
      dataRef.current?.items.find((item) => item.identifier === id)?.issueId ??
      id
    const request = planningRequest<IssueDetail>(
      `/api/issues/${encodeURIComponent(stableId)}?cycle=${encodeURIComponent(dataRef.current?.cycles.find((c) => c.kind === "current")?.id ?? "planning")}`
    )
      .then((detail) => {
        if (!mounted.current || epoch !== generation.current) return
        const root =
          detail.nodes.find(
            (node) => node.uuid === stableId || node.id === id
          ) ?? detail.nodes[0]
        detailsRef.current = {
          ...detailsRef.current,
          [id]: detail,
          [root.id]: detail,
        }
        if (root.id !== id)
          setSelected((value) => (value === id ? root.id : value))
        setDetails(detailsRef.current)
        setFailures((current) => {
          const next = { ...current }
          delete next[id]
          return next
        })
      })
      .catch((reason) => {
        if (mounted.current && epoch === generation.current)
          setFailures((current) => ({ ...current, [id]: reason.message }))
      })
      .finally(() => {
        requests.current.delete(key)
      })
    requests.current.set(key, request)
    return request
  }, [])
  const refreshDetails = useCallback(async () => {
    generation.current++
    const ids = [
      ...new Set([
        ...(dataRef.current?.items.map((item) => item.identifier) ?? []),
        ...Object.keys(detailsRef.current),
      ]),
    ]
    let index = 0
    await Promise.all(
      Array.from({ length: Math.min(4, ids.length) }, async () => {
        while (index < ids.length) await loadDetail(ids[index++], true)
      })
    )
  }, [loadDetail])
  useEffect(() => {
    void refresh().catch((e) => setError(e.message))
    const initial = new URL(window.location.href).searchParams.get("issue")
    if (initial) {
      const frame = requestAnimationFrame(() => setSelected(initial))
      return () => cancelAnimationFrame(frame)
    }
  }, [refresh])
  const membershipKey =
    data?.items
      .map((item) => item.identifier)
      .sort()
      .join(",") ?? ""
  useEffect(() => {
    const ids = membershipKey.split(",").filter(Boolean)
    let index = 0,
      canceled = false
    void Promise.all(
      Array.from({ length: Math.min(4, ids.length) }, async () => {
        while (!canceled && index < ids.length) await loadDetail(ids[index++])
      })
    )
    return () => {
      canceled = true
    }
  }, [membershipKey, loadDetail])
  useEffect(() => {
    if (selected) void loadDetail(selected)
  }, [selected, loadDetail])
  useEffect(() => {
    const onFocus = () => {
      void refresh()
        .then(() => refreshDetails())
        .catch((e) => setError(e.message))
    }
    const onPop = () =>
      setSelected(new URL(window.location.href).searchParams.get("issue"))
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setSearch(true)
      }
    }
    window.addEventListener("focus", onFocus)
    window.addEventListener("popstate", onPop)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("focus", onFocus)
      window.removeEventListener("popstate", onPop)
      window.removeEventListener("keydown", onKey)
    }
  }, [refresh, refreshDetails])
  const wasBusy = useRef(false)
  useEffect(() => {
    if (wasBusy.current && !issueBusy.size) void refreshDetails()
    wasBusy.current = issueBusy.size > 0
  }, [issueBusy, refreshDetails])
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    const update = () => setMobile(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])
  function select(id: string | null) {
    setSelected(id)
    if (id) setPanelOpen(true)
    const link = new URL(window.location.href)
    if (id)
      link.searchParams.set(
        "issue",
        Object.values(detailsRef.current)
          .flatMap((detail) => detail.nodes)
          .find((node) => node.id === id)?.uuid ?? id
      )
    else link.searchParams.delete("issue")
    window.history.pushState(null, "", link)
  }
  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      notify("Enlace copiado")
    } catch {
      notify("No se pudo copiar el enlace", "error")
    }
  }
  async function membership(ids: string[], included: boolean) {
    if (!ids.length || busy) return
    setBusy(true)
    try {
      const allChanges: MembershipChange[] = [],
        errors: string[] = []
      // Small requests keep the operation recoverable on serverless runtimes.
      for (let index = 0; index < ids.length; index += 5) {
        const result = await planningRequest<{
          changes: MembershipChange[]
          errors: string[]
          items: StageItem[]
        }>(url, {
          action: "membership",
          ids: ids.slice(index, index + 5).map(
            (id) =>
              Object.values(detailsRef.current)
                .flatMap((detail) => detail.nodes)
                .find((node) => node.id === id)?.uuid ?? id
          ),
          included,
        })
        allChanges.push(...result.changes)
        errors.push(...result.errors)
        setData((value) => value && { ...value, items: result.items })
        setUndo([...allChanges])
      }
      if (errors.length) setError(errors.join(" · "))
      else {
        setError(null)
        notify(included ? "Agregado a la hoja" : "Quitado de la hoja")
      }
    } catch (e) {
      setError((e as Error).message)
      void refresh().catch(() => {})
    } finally {
      setBusy(false)
    }
  }
  async function undoMembership() {
    if (!undo) return
    setBusy(true)
    try {
      const result = await planningRequest<{
        skipped: number
        items: StageItem[]
      }>(url, { action: "undo", changes: undo })
      setData((value) => value && { ...value, items: result.items })
      setUndo(null)
      notify(
        result.skipped
          ? "Se conservaron los cambios posteriores de otras personas"
          : "Cambio deshecho"
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function edit(patch: { name?: string; archived?: boolean }) {
    if (!data) return
    setBusy(true)
    try {
      const result = await planningRequest<{ stage: Stage }>(url, {
        action: "edit",
        version: data.stage.version,
        ...patch,
      })
      setData({ ...data, stage: result.stage })
      setRename(false)
      notify("Hoja guardada")
    } catch (e) {
      setError((e as Error).message)
      await refresh().catch(() => {})
    } finally {
      setBusy(false)
    }
  }
  async function duplicate() {
    if (!data) return
    setBusy(true)
    try {
      const result = await planningRequest<{ stage: Stage }>("/api/planning", {
        name: `${data.stage.name.slice(0, 90)} · copia`,
        sourceId: stageId,
      })
      router.push(`/planning/${result.stage.id}`)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function runTransfer(id: string, undoTransfer = false) {
    if (running) return
    setRunning(id)
    try {
      const latest = await refresh()
      const transfer = latest.transfers.find((item) => item.id === id)
      if (!transfer) throw new Error("No se encontró el traslado.")
      for (const item of transfer.items) {
        if (
          !(
            undoTransfer
              ? ["done", "undo-failed", "undoing"]
              : ["pending", "failed", "applying"]
          ).includes(item.status)
        )
          continue
        try {
          await planningRequest(url, {
            action: "execute",
            transferId: id,
            issueId: item.issueId,
            undo: undoTransfer,
          })
        } catch (e) {
          setError((e as Error).message)
        }
        if (!mounted.current) break
        await refresh()
      }
      const sync = await planningRequest<{ synced: boolean; error?: string }>(
        url,
        { action: "sync" }
      )
      if (!sync.synced) setError(sync.error ?? "Falta sincronizar el ciclo.")
      await refreshDetails()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      if (mounted.current) setRunning(null)
    }
  }
  const cycle: Cycle = useMemo(() => {
    const current = data?.cycles.find((cycle) => cycle.kind === "current")
    return {
      id: current?.id ?? "planning",
      name: current?.name ?? "Sin ciclo activo",
      number: current?.number ?? 0,
      start: current?.startsAt ?? "",
      end: current?.endsAt ?? "",
      team: "Equipo",
      taken: "",
      live: true,
      workspace: "movosend",
    }
  }, [data?.cycles])
  const nodesById = useMemo(() => {
    const map = new Map<string, Node>()
    Object.values(details).forEach((detail) =>
      detail.nodes.forEach((node) => map.set(node.id, node))
    )
    // Prefer a node's own full response over a neighboring context copy.
    Object.entries(details).forEach(([id, detail]) => {
      const own =
        detail.nodes.find((node) => node.id === id || node.uuid === id) ??
        detail.nodes[0]
      if (own) map.set(own.id, own)
    })
    return map
  }, [details])
  const included = useMemo(
    () =>
      new Set(
        data?.items.map(
          (item) =>
            [...nodesById.values()].find((node) => node.uuid === item.issueId)
              ?.id ?? item.identifier
        ) ?? []
      ),
    [data?.items, nodesById]
  )
  const snapshot: Snapshot = useMemo(() => {
    const blocks = new Map<string, [string, string]>()
    Object.entries(details).forEach(([id, detail]) => {
      if (included.has(detail.nodes[0]?.id) || selected === id)
        detail.blocks.forEach((edge) => blocks.set(edge.join("|"), edge))
    })
    const metadata =
      (selected && details[selected]) || Object.values(details)[0]
    return {
      cycle,
      analysis: null,
      nodes: [...nodesById.values()],
      blocks: [...blocks.values()],
      states: metadata?.states ?? [],
      members: metadata?.members ?? [],
    }
  }, [cycle, details, included, nodesById, selected])
  const graphSnapshot = useMemo(
    () => planningGraph(snapshot, included, resolved),
    [snapshot, included, resolved]
  )
  const chosen = snapshot.nodes.filter(
    (node) => included.has(node.id) && !node.isEpic
  )
  const points = planPoints(chosen)
  const outsideBlockers = [
    ...new Set(
      snapshot.blocks
        .filter(
          ([a, b]) =>
            included.has(b) &&
            !included.has(a) &&
            nodesById.has(a) &&
            !nodesById.get(a)!.isEpic &&
            isPending(nodesById.get(a)!)
        )
        .map(([a]) => a)
    ),
  ]
  const missing = (data?.items ?? []).filter(
    (item) => !details[item.identifier] && !details[item.issueId]
  )
  const highlighted =
    summaryFilter === "all"
      ? included
      : summaryFilter === "unestimated"
        ? new Set(
            chosen
              .filter((node) => isPending(node) && node.pts === null)
              .map((node) => node.id)
          )
        : summaryFilter === "blockers"
          ? new Set(outsideBlockers)
          : null
  const selectedNode = selected ? nodesById.get(selected) : null
  const planning = {
    included,
    busy: busy || Boolean(data?.stage.archived),
    onToggle: (node: Node) => {
      void membership([node.id], !included.has(node.id))
    },
    onManageDependencies: () => setDependencyOpen(true),
    onAddMany: (ids: string[]) => {
      void membership(ids, true)
    },
  }
  const panel = selected ? (
    failures[selected] ? (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertDescription>
            {failures[selected]}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void loadDetail(selected, true)}
            >
              Reintentar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => select(null)}>
              Volver
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    ) : !details[selected] || !selectedNode ? (
      <p role="status" className="p-4 text-xs text-muted-foreground">
        Cargando {selected}…
      </p>
    ) : (
      <SidePanel
        selected={selectedNode}
        nodesById={nodesById}
        graph={buildGraph(snapshot, true)}
        chain={[]}
        bottlenecksList={[]}
        stranded={[]}
        openBlocksList={[]}
        analysis={null}
        workspace={cycle.workspace}
        cycle={cycle}
        states={snapshot.states}
        members={snapshot.members}
        onSelect={select}
        onBack={() => select(null)}
        onHover={() => {}}
        onFocus={
          graphSnapshot.nodes.some((node) => node.id === selected)
            ? () => setFocusRequest((value) => value + 1)
            : undefined
        }
        onShareIssue={() => void share()}
        group={null}
        onGroup={() => {}}
        planning={planning}
      />
    )
  ) : (
    <div className="flex h-full flex-col gap-5 overflow-auto p-4">
      <div>
        <h2 className="text-sm font-semibold">La propuesta</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Solo las issues incorporadas cuentan. Las sugerencias quedan afuera.
        </p>
      </div>
      <div className="flex flex-col gap-1">
        {(
          [
            ["all", "Issues incluidas", chosen.length],
            ["unestimated", "Sin estimar", points.unestimated],
            [
              "blockers",
              "Bloqueantes fuera de la hoja",
              outsideBlockers.length,
            ],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            className="flex cursor-pointer items-center gap-3 rounded-lg p-2 text-left text-xs hover:bg-muted"
            onClick={() => setSummaryFilter(summaryFilter === key ? null : key)}
          >
            <span className="flex-1">{label}</span>
            <Badge variant={summaryFilter === key ? "default" : "secondary"}>
              {count}
            </Badge>
            <ArrowRightIcon className="size-3 text-muted-foreground" />
          </button>
        ))}
        <p className="px-2 pt-2 text-xs text-muted-foreground">
          {points.total} puntos conocidos
          {missing.length || Object.keys(failures).length
            ? " · datos incompletos"
            : ""}
        </p>
      </div>
      {summaryFilter && (
        <div className="flex flex-col gap-1">
          {[...(highlighted ?? [])].map((id) => (
            <Button
              key={id}
              variant="ghost"
              size="sm"
              className="justify-start"
              onClick={() => select(id)}
            >
              {id} · {nodesById.get(id)?.short ?? "Cargando…"}
            </Button>
          ))}
        </div>
      )}
      {included.size > 0 && (
        <details>
          <summary className="cursor-pointer text-xs font-medium">
            Issues de la hoja · {included.size}
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            {[...included].map((id) => (
              <div key={id} className="flex items-center gap-2">
                <button
                  className="min-w-0 flex-1 truncate text-left text-xs hover:underline"
                  onClick={() => select(id)}
                >
                  {id} · {nodesById.get(id)?.short ?? "Datos no disponibles"}
                </button>
                <Button
                  variant="ghost"
                  size="xs"
                  disabled={planning.busy}
                  onClick={() => void membership([id], false)}
                >
                  Quitar
                </Button>
              </div>
            ))}
          </div>
        </details>
      )}
      <div className="border-t pt-4">
        <h3 className="text-xs font-medium">Traslados</h3>
        {!data?.transfers.length && (
          <p className="mt-2 text-xs text-muted-foreground">
            Todavía no llevaste esta propuesta a un ciclo.
          </p>
        )}
        {data?.transfers
          .slice()
          .reverse()
          .map((transfer) => (
            <details
              key={transfer.id}
              className="mt-3 rounded-lg border p-3"
              open={running === transfer.id || undefined}
            >
              <summary className="cursor-pointer text-xs">
                {transfer.cycleName} ·{" "}
                {
                  transfer.items.filter(
                    (item) =>
                      item.status === "done" || item.status === "skipped"
                  ).length
                }
                /{transfer.items.length} en destino
              </summary>
              <div className="mt-3 flex flex-col gap-2">
                {transfer.items.map((item) => (
                  <div key={item.issueId} className="text-[11px]">
                    <span>
                      {item.identifier} · {statusLabel(item.status)}
                    </span>
                    {item.error && (
                      <p className="mt-1 text-destructive">{item.error}</p>
                    )}
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  {transfer.items.some((item) =>
                    ["pending", "failed", "applying"].includes(item.status)
                  ) && (
                    <Button
                      variant="outline"
                      size="xs"
                      disabled={!!running}
                      onClick={() => void runTransfer(transfer.id)}
                    >
                      Continuar / reintentar
                    </Button>
                  )}
                  {transfer.items.some((item) =>
                    ["done", "undo-failed", "undoing"].includes(item.status)
                  ) && (
                    <Button
                      variant="ghost"
                      size="xs"
                      disabled={!!running}
                      onClick={() => void runTransfer(transfer.id, true)}
                    >
                      Deshacer traslados
                    </Button>
                  )}
                </div>
              </div>
            </details>
          ))}
      </div>
    </div>
  )
  if (!data)
    return (
      <div className="p-6">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>
              {error}
              <Button
                variant="ghost"
                onClick={() => void refresh().catch((e) => setError(e.message))}
              >
                Reintentar
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <p role="status" className="text-sm text-muted-foreground">
            Cargando hoja…
          </p>
        )}
      </div>
    )
  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <Link
          href="/planning"
          aria-label="Volver a las hojas"
          className="rounded-md p-2 hover:bg-muted"
        >
          <ArrowLeftIcon className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold">{data.stage.name}</h1>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
            {busy ? (
              <>
                <Loader2Icon className="size-3 animate-spin" />
                Guardando…
              </>
            ) : (
              <>
                <CheckIcon className="size-3" />
                {error
                  ? "Revisá el aviso"
                  : "Guardado · Compartida con el equipo"}
              </>
            )}
          </p>
        </div>
        {data.stage.archived && <Badge variant="outline">Archivada</Badge>}
        <Button
          variant="ghost"
          size="icon-sm"
          title="Renombrar hoja"
          aria-label="Renombrar hoja"
          disabled={busy}
          onClick={() => {
            setName(data.stage.name)
            setRename(true)
          }}
        >
          <PencilIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Duplicar hoja"
          aria-label="Duplicar hoja"
          disabled={busy}
          onClick={() => void duplicate()}
        >
          <CopyIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title={data.stage.archived ? "Restaurar hoja" : "Archivar hoja"}
          aria-label={data.stage.archived ? "Restaurar hoja" : "Archivar hoja"}
          disabled={busy || !!running}
          onClick={() => void edit({ archived: !data.stage.archived })}
        >
          <ArchiveIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="Copiar enlace"
          aria-label="Copiar enlace"
          onClick={() => void share()}
        >
          <LinkIcon />
        </Button>
        <Button
          size="sm"
          disabled={
            data.stage.archived ||
            !included.size ||
            !data.cycles.length ||
            busy ||
            !!running
          }
          onClick={() => setTransferOpen(true)}
        >
          Llevar a ciclo…
        </Button>
      </header>
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2">
        <Button variant="outline" size="sm" onClick={() => setSearch(true)}>
          <PlusIcon data-icon="inline-start" />
          Agregar US
        </Button>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <Checkbox checked={resolved} onCheckedChange={setResolved} />
          Mostrar resueltas
        </label>
        {undo && (
          <Button
            variant="ghost"
            size="sm"
            disabled={planning.busy}
            onClick={() => void undoMembership()}
          >
            <Undo2Icon data-icon="inline-start" />
            Deshacer
          </Button>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Actualizar datos"
            title="Actualizar datos"
            onClick={() =>
              void refresh()
                .then(() => refreshDetails())
                .catch((e) => setError(e.message))
            }
          >
            <RefreshCwIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Alternar panel"
            title="Alternar panel"
            onClick={() => setPanelOpen(!panelOpen)}
          >
            <PanelRightIcon />
          </Button>
        </div>
      </div>
      <PlanCapacity
        stageId={stageId}
        nodes={chosen}
        incomplete={missing.length > 0 || Object.keys(failures).length > 0}
      />
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {error}
            <Button variant="ghost" size="xs" onClick={() => setError(null)}>
              Cerrar
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {(missing.length > 0 || Object.keys(failures).length > 0) && (
        <Alert>
          <AlertDescription>
            {Object.keys(failures).length
              ? "No se pudieron cargar algunas issues. El resumen puede estar incompleto."
              : `Cargando dependencias de ${missing.length} issues…`}
            {Object.keys(failures).length > 0 && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => void refreshDetails()}
              >
                Reintentar
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}
      {running && (
        <p
          role="status"
          className="flex items-center gap-2 border-b px-4 py-2 text-xs"
        >
          <Loader2Icon className="size-3 animate-spin" />
          Procesando traslado… El resultado de cada issue queda guardado.
        </p>
      )}
      <div className="flex min-h-0 flex-1">
        <PlanningCanvas
          snapshot={graphSnapshot}
          included={included}
          selected={selected}
          highlighted={highlighted}
          onSelect={select}
          onAdd={(id) => void membership([id], true)}
          busy={planning.busy}
          focusRequest={focusRequest}
        />
        {panelOpen && !mobile && (
          <aside className="w-[360px] max-w-[45%] shrink-0 border-l">
            {panel}
          </aside>
        )}
      </div>
      {mobile && (
        <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
          <SheetContent className="w-full sm:max-w-none">
            <SheetTitle className="sr-only">
              {selectedNode?.title ?? "La propuesta"}
            </SheetTitle>
            <SheetDescription className="sr-only">
              Detalle y acciones de la hoja
            </SheetDescription>
            <div className="min-h-0 flex-1 pt-8">{panel}</div>
          </SheetContent>
        </Sheet>
      )}
      <IssueSearchCommand
        open={search}
        onOpenChange={setSearch}
        cycle={cycle}
        nodes={snapshot.nodes}
        onSelectIssue={select}
        planning={{
          included,
          busy: planning.busy,
          onAdd: (id) => {
            void membership([id], true)
          },
        }}
      />
      {dependencyOpen && selectedNode && selected && details[selected] && (
        <DependencyDialog
          key={selectedNode.id}
          stageId={stageId}
          source={selectedNode}
          detail={details[selected]}
          snapshot={snapshot}
          open={dependencyOpen}
          onOpenChange={setDependencyOpen}
          onUpdated={async () => {
            await refreshDetails()
            notify("Dependencias actualizadas")
          }}
        />
      )}
      {transferOpen && (
        <TransferDialog
          stageId={stageId}
          cycles={data.cycles}
          open={transferOpen}
          onOpenChange={setTransferOpen}
          onCreated={async (id) => {
            select(null)
            setPanelOpen(true)
            await runTransfer(id)
          }}
        />
      )}
      <Dialog open={rename} onOpenChange={setRename}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renombrar hoja</DialogTitle>
            <DialogDescription>
              El nombre se actualiza para todo el equipo.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              void edit({ name })
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="stage-name">Nombre</FieldLabel>
                <Input
                  id="stage-name"
                  autoFocus
                  value={name}
                  maxLength={100}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="submit" disabled={busy || !name.trim()}>
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
function statusLabel(status: string) {
  return (
    (
      {
        pending: "Pendiente",
        applying: "En proceso",
        done: "Trasladada",
        skipped: "Ya estaba en destino",
        failed: "No se pudo trasladar",
        undoing: "Deshaciendo",
        undone: "Deshecha",
        "undo-failed": "No se pudo deshacer",
      } as Record<string, string>
    )[status] ?? status
  )
}
