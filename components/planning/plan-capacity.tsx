"use client"
import { useEffect, useState } from "react"
import { InfoIcon } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  forecastPlan,
  planPoints,
  type Velocity,
} from "@/lib/planning/forecast"
import type { Node } from "@/lib/schema/snapshot"
import { planningRequest } from "./api"
const number = (value: number) =>
  new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value)
const durationNumber = (value: number) =>
  value > 0 && value < 0.1 ? "< 0,1" : number(value)
export function PlanCapacity({
  stageId,
  nodes,
  incomplete,
}: {
  stageId: string
  nodes: Node[]
  incomplete: boolean
}) {
  const [velocity, setVelocity] = useState<Velocity | null>(null)
  const [error, setError] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let canceled = false
    planningRequest<Velocity>(`/api/planning/${stageId}/velocity`)
      .then((data) => {
        if (!canceled) {
          setVelocity(data)
          setError(false)
        }
      })
      .catch(() => {
        if (!canceled) setError(true)
      })
    return () => {
      canceled = true
    }
  }, [stageId, attempt])
  const points = planPoints(nodes)
  const forecast = forecastPlan(points, velocity, incomplete)
  const missingEstimate =
    points.pendingCount > 0 && points.remaining === 0 && points.unestimated > 0
  const duration = incomplete
    ? "Datos incompletos"
    : !points.pendingCount
      ? "Sin trabajo pendiente"
      : missingEstimate
        ? "Falta estimar"
        : forecast
          ? `≈ ${durationNumber(forecast.cycles)} ciclos`
          : error
            ? "No disponible"
            : !velocity
              ? "Calculando…"
              : "Sin base suficiente"
  return (
    <section
      aria-label="Puntos y duración del plan"
      className="flex h-9 shrink-0 items-center gap-2 border-b bg-background px-4"
    >
      <div className="flex min-w-0 flex-1 items-center gap-5 overflow-x-auto whitespace-nowrap">
        <Metric
          label="Plan"
          value={`${number(points.total)} pt`}
          detail={`${number(points.completed)} completados · ${incomplete ? "datos incompletos" : "solo US incluidas"}`}
        />
        <Metric
          label="Pendiente"
          value={`${number(points.remaining)} pt`}
          detail={`${points.unestimated} US pendientes sin estimar`}
        />
        <Metric
          label="Velocity"
          value={
            velocity?.averagePoints !== null && velocity
              ? `${number(velocity.averagePoints)} pt / ciclo`
              : error
                ? "No disponible"
                : velocity
                  ? "Sin historial"
                  : "Cargando…"
          }
          detail={
            velocity
              ? `${velocity.samples.length} ciclos cerrados con datos`
              : "Histórico de Linear"
          }
        />
        <Metric
          label={`Duración${forecast?.partial ? " parcial" : ""}`}
          value={duration}
          detail={
            forecast && !missingEstimate && points.pendingCount
              ? `≈ ${durationNumber(forecast.days / 7)} semanas de capacidad del equipo`
              : "Requiere al menos 2 ciclos con datos y velocidad mayor a cero"
          }
        />
      </div>
      <Dialog>
        <DialogTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Cómo se calculan los puntos y la duración"
              title="Cómo se calcula"
            />
          }
        >
          <InfoIcon />
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Puntos y duración del plan</DialogTitle>
          </DialogHeader>
          <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto text-xs text-muted-foreground">
            <p>
              {number(points.completed)} pt completados · {points.unestimated}{" "}
              US pendientes sin estimar
              {incomplete ? " · Datos incompletos" : ""}.
            </p>
            {forecast && !missingEstimate && points.pendingCount > 0 && (
              <p>
                Duración orientativa: {duration} · ≈{" "}
                {durationNumber(forecast.days / 7)} semanas
                {forecast.partial ? " (parcial: faltan US por estimar)" : ""}.
              </p>
            )}
            <p>
              Puntos pendientes estimados ÷ promedio de puntos completados de
              los últimos 5 ciclos cerrados. Las semanas usan la duración media
              de esos ciclos. Los ciclos con 0 puntos también cuentan; si faltan
              datos, no se supone una velocidad.
            </p>
            <p>
              Supone dedicar la capacidad del equipo a este plan. No incluye US
              sin estimar, sugerencias, trabajo de otros planes ni esperas por
              bloqueos externos. No es una fecha de entrega.
            </p>
            <p>
              El historial usa los puntos al cierre registrados por Linear;
              puede reflejar convenciones de estimación anteriores. Las US
              canceladas y las épicas no suman puntos al plan.
            </p>
            {velocity?.samples.map((sample) => (
              <p key={sample.id}>
                {sample.name}: {number(sample.completedPoints)} pt ·{" "}
                {number(sample.days)} días
              </p>
            ))}
            {error && (
              <Button
                variant="ghost"
                size="xs"
                className="self-start"
                onClick={() => {
                  setError(false)
                  setAttempt((n) => n + 1)
                }}
              >
                Reintentar consulta de velocity
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
function Metric({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div
      className="flex shrink-0 items-baseline gap-1.5 text-[11px]"
      title={detail}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
      {label === "Pendiente" && (
        <span className="text-muted-foreground">
          · {detail.replace(" US pendientes sin estimar", " sin estimar")}
        </span>
      )}
    </div>
  )
}
