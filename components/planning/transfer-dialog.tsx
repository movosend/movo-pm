"use client"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import type { PlanningCycle, TransferRow } from "@/lib/planning/types"
import { planningRequest } from "./api"

export function TransferDialog({
  stageId,
  cycles,
  open,
  onOpenChange,
  onCreated,
}: {
  stageId: string
  cycles: PlanningCycle[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (id: string) => Promise<void>
}) {
  const [destination, setDestination] = useState(cycles[0]?.id ?? "")
  const [review, setReview] = useState<{
    cycleId: string
    rows: TransferRow[]
  } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const request = useRef<{ signature: string; id: string } | null>(null)
  const rows = review?.cycleId === destination ? review.rows : null
  useEffect(() => {
    if (!open || !destination) return
    let canceled = false
    planningRequest<{ rows: TransferRow[] }>(`/api/planning/${stageId}`, {
      action: "review",
      cycleId: destination,
    })
      .then((body) => {
        if (!canceled) {
          setReview({ cycleId: destination, rows: body.rows })
          setError(null)
        }
      })
      .catch((e) => {
        if (!canceled) setError(e.message)
      })
    return () => {
      canceled = true
    }
  }, [destination, stageId, open, attempt])
  const selected = rows?.filter((row) => row.selected && row.eligible) ?? []
  const selectedIds = new Set(selected.map((row) => row.identifier))
  const blockers = [...new Set(selected.flatMap((row) => row.blockers))].filter(
    (id) => !selectedIds.has(id)
  )
  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      const signature = JSON.stringify([
        destination,
        selected.map((row) => [row.issueId, row.beforeCycleId]),
      ])
      if (request.current?.signature !== signature)
        request.current = { signature, id: crypto.randomUUID() }
      const result = await planningRequest<{ id: string }>(
        `/api/planning/${stageId}`,
        {
          action: "transfer",
          requestId: request.current.id,
          cycleId: destination,
          selected: selected.map((row) => ({
            issueId: row.issueId,
            beforeCycleId: row.beforeCycleId,
          })),
        }
      )
      onOpenChange(false)
      await onCreated(result.id)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) onOpenChange(value)
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Llevar a ciclo</DialogTitle>
          <DialogDescription>
            Revisá la selección. La hoja se conserva después del traslado.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="cycle-destination">Ciclo destino</FieldLabel>
            <select
              id="cycle-destination"
              className="rounded-lg border bg-background p-2 text-sm"
              disabled={busy}
              value={destination}
              onChange={(e) => {
                setDestination(e.target.value)
                setReview(null)
                setError(null)
              }}
            >
              {cycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {cycle.kind === "current" ? "Actual" : "Siguiente"} ·{" "}
                  {cycle.name} ·{" "}
                  {new Date(cycle.startsAt).toLocaleDateString("es-AR")} –{" "}
                  {new Date(cycle.endsAt).toLocaleDateString("es-AR")}
                </option>
              ))}
            </select>
          </Field>
        </FieldGroup>
        {!cycles.some((c) => c.kind === "next") && (
          <p className="text-xs text-muted-foreground">
            No hay un próximo ciclo disponible en Linear.
          </p>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              {error}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setReview(null)
                  setError(null)
                  setAttempt((a) => a + 1)
                }}
              >
                Actualizar revisión
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {!rows && !error && (
          <p role="status" className="text-xs text-muted-foreground">
            Consultando datos actuales y dependencias…
          </p>
        )}
        <FieldSet className="max-h-[45vh] overflow-auto">
          <FieldLegend className="sr-only">Issues a trasladar</FieldLegend>
          {rows?.map((row) => (
            <label
              key={row.issueId}
              className="flex cursor-pointer items-start gap-3 rounded-lg p-2 hover:bg-muted/50"
            >
              <Checkbox
                className="mt-1"
                checked={row.selected && row.eligible}
                disabled={!row.eligible || busy}
                onCheckedChange={(checked) =>
                  setReview(
                    (current) =>
                      current && {
                        ...current,
                        rows: current.rows.map((item) =>
                          item.issueId === row.issueId
                            ? { ...item, selected: checked }
                            : item
                        ),
                      }
                  )
                }
              />
              <span className="min-w-0 flex-1">
                <span className="block text-xs">{row.title}</span>
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  {row.identifier} · {row.points ?? "Sin estimar"}
                  {row.points !== null ? " pt" : ""}
                  {row.beforeCycleId && row.eligible
                    ? ` · Mover desde ${row.beforeCycleName ?? "otro ciclo"}`
                    : ""}
                </span>
              </span>
              {row.reason && <Badge variant="outline">{row.reason}</Badge>}
            </label>
          ))}
        </FieldSet>
        {rows && (
          <div className="flex flex-col gap-2 text-xs text-muted-foreground">
            <p>
              {selected.length} issues ·{" "}
              {selected.reduce((sum, row) => sum + (row.points ?? 0), 0)} puntos
              conocidos · {selected.filter((r) => r.points === null).length} sin
              estimar
            </p>
            {blockers.length > 0 && (
              <p>
                Bloqueantes pendientes fuera del destino: {blockers.join(", ")}.
                Podés continuar y revisarlos desde la hoja.
              </p>
            )}
          </div>
        )}
        {selected.length > 100 && (
          <p className="text-xs text-destructive">
            Elegí hasta 100 issues por traslado. La hoja se conserva para
            trasladar el resto después.
          </p>
        )}
        <DialogFooter>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            disabled={busy || !selected.length || selected.length > 100}
            onClick={() => void confirm()}
          >
            {busy ? "Preparando…" : `Trasladar ${selected.length} issues`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
