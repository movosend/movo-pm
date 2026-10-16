"use client"
import { useRef, useState } from "react"
import { ArrowRightIcon, SearchIcon, Trash2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { IssueSearchCommand } from "@/components/graph/issue-search-command"
import type { IssueDetail, Node, Snapshot } from "@/lib/schema/snapshot"
import { planningRequest } from "./api"

export function DependencyDialog({
  stageId,
  source,
  detail,
  snapshot,
  open,
  onOpenChange,
  onUpdated,
}: {
  stageId: string
  source: Node
  detail: IssueDetail
  snapshot: Snapshot
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: () => Promise<void>
}) {
  const [direction, setDirection] = useState<"blocks" | "blockedBy">(
    "blockedBy"
  )
  const [target, setTarget] = useState<Node | null>(null)
  const [search, setSearch] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const request = useRef<{ signature: string; id: string } | null>(null)
  async function choose(id: string) {
    setBusy(true)
    setError(null)
    try {
      const result = await planningRequest<IssueDetail>(
        `/api/issues/${encodeURIComponent(id)}?cycle=${encodeURIComponent(snapshot.cycle.id)}`
      )
      const node = result.nodes.find(
        (node) => node.id === id || node.uuid === id
      )
      if (!node || node.isEpic)
        throw new Error("Elegí una US de trabajo, no una épica.")
      if (node.uuid === source.uuid || node.id === source.id)
        throw new Error("Elegí otra US: no puede bloquearse a sí misma.")
      setTarget(node)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  async function save(removeId?: string) {
    if (!removeId && !target) return
    setBusy(true)
    setError(null)
    setFeedback(null)
    try {
      const signature = `${source.id}|${target?.id}|${direction}`
      if (request.current?.signature !== signature)
        request.current = { signature, id: crypto.randomUUID() }
      const result = await planningRequest<{ changed: boolean }>(
        `/api/planning/${stageId}`,
        removeId
          ? {
              action: "removeDependency",
              sourceId: source.uuid ?? source.id,
              removeId,
            }
          : {
              action: "dependency",
              sourceId: source.uuid ?? source.id,
              targetId: target!.uuid ?? target!.id,
              direction,
              requestId: request.current.id,
            }
      )
      await onUpdated()
      request.current = null
      if (!removeId) setTarget(null)
      setFeedback(
        result.changed
          ? removeId
            ? "Bloqueo quitado de Linear."
            : "Bloqueo guardado en Linear."
          : "La relación ya tenía ese estado."
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const [blocker, blocked] =
    direction === "blocks" ? [source, target] : [target, source]
  const relations = detail.blockingRelations ?? []
  return (
    <>
      <Dialog
        open={open && !search}
        onOpenChange={(value) => {
          if (!busy) onOpenChange(value)
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Dependencias de {source.id}</DialogTitle>
            <DialogDescription>
              Los bloqueos se guardan en Linear. La otra US puede quedar como
              sugerida hasta que la agregues al plan.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm font-medium">{source.title}</p>
          <ToggleGroup
            value={[direction]}
            onValueChange={(values) => {
              if (values[0]) setDirection(values[0] as "blocks" | "blockedBy")
            }}
            disabled={busy}
            variant="outline"
            size="sm"
            aria-label="Dirección del bloqueo"
          >
            <ToggleGroupItem value="blockedBy">
              Está bloqueada por
            </ToggleGroupItem>
            <ToggleGroupItem value="blocks">Bloquea a</ToggleGroupItem>
          </ToggleGroup>
          <Button
            variant="outline"
            disabled={busy}
            className="justify-start"
            onClick={() => setSearch(true)}
          >
            <SearchIcon data-icon="inline-start" />
            {target ? `${target.id} · ${target.short}` : "Elegir otra US…"}
          </Button>
          {target && (
            <div className="rounded-lg border bg-muted/30 p-3 text-xs">
              <p className="flex items-center gap-2 font-medium">
                {blocker?.id}
                <ArrowRightIcon className="size-3" />
                {blocked?.id}
              </p>
              <p className="mt-1 text-muted-foreground">
                {blocked?.id} necesita que {blocker?.id} se resuelva antes de
                avanzar.
              </p>
            </div>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {feedback && (
            <p role="status" className="text-xs text-muted-foreground">
              {feedback}
            </p>
          )}
          <section className="flex max-h-56 flex-col gap-2 overflow-auto border-t pt-3">
            <h3 className="text-xs font-medium">
              Bloqueos actuales · {relations.length}
            </h3>
            {!relations.length && (
              <p className="text-xs text-muted-foreground">
                Esta US está suelta: todavía no tiene bloqueos.
              </p>
            )}
            {relations.map((relation) => (
              <div
                key={relation.id}
                className="flex items-center gap-2 rounded-lg border p-2"
              >
                <div className="min-w-0 flex-1 text-xs">
                  <p>
                    {relation.blocker} → {relation.blocked}
                  </p>
                  <p className="mt-1 truncate text-[10px] text-muted-foreground">
                    {
                      snapshot.nodes.find(
                        (node) =>
                          node.id ===
                          (relation.blocker === source.id
                            ? relation.blocked
                            : relation.blocker)
                      )?.title
                    }
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={busy}
                  aria-label={`Quitar bloqueo de ${relation.blocker} a ${relation.blocked}`}
                  title="Quitar bloqueo en Linear"
                  onClick={() => void save(relation.id)}
                >
                  <Trash2Icon />
                </Button>
              </div>
            ))}
          </section>
          <DialogFooter>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Cerrar
            </Button>
            <Button disabled={busy || !target} onClick={() => void save()}>
              {busy ? "Guardando…" : "Guardar bloqueo en Linear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <IssueSearchCommand
        open={search}
        onOpenChange={setSearch}
        cycle={snapshot.cycle}
        nodes={snapshot.nodes}
        onSelectIssue={(id) => void choose(id)}
      />
    </>
  )
}
