"use client"
import { useEffect, useState } from "react"
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
      className="border-b bg-background px-4 py-3"
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-4">
        <Metric
          label="Puntos en el plan"
          value={`${number(points.total)} pt`}
          detail={`${number(points.completed)} completados · ${incomplete ? "datos incompletos" : "solo US incluidas"}`}
        />
        <Metric
          label="Trabajo pendiente"
          value={`${number(points.remaining)} pt`}
          detail={`${points.unestimated} US pendientes sin estimar`}
        />
        <Metric
          label="Velocidad del equipo"
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
          label={`Duración orientativa${forecast?.partial ? " · parcial" : ""}`}
          value={duration}
          detail={
            forecast && !missingEstimate && points.pendingCount
              ? `≈ ${durationNumber(forecast.days / 7)} semanas de capacidad del equipo`
              : "Requiere al menos 2 ciclos con datos y velocidad mayor a cero"
          }
        />
      </div>
      <details className="mt-2 text-[11px] text-muted-foreground">
        <summary className="w-fit cursor-pointer">Cómo se calcula</summary>
        <div className="mt-2 flex flex-col gap-1">
          <p>
            Puntos pendientes estimados ÷ promedio de puntos completados de los
            últimos 5 ciclos cerrados. Las semanas usan la duración media de
            esos ciclos. Los ciclos con 0 puntos también cuentan; si faltan
            datos, no se supone una velocidad.
          </p>
          <p>
            Supone dedicar la capacidad del equipo a este plan. No incluye US
            sin estimar, sugerencias, trabajo de otros planes ni esperas por
            bloqueos externos. No es una fecha de entrega.
          </p>
          <p>
            El historial usa los puntos al cierre registrados por Linear; puede
            reflejar convenciones de estimación anteriores. Las US canceladas y
            las épicas no suman puntos al plan.
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
      </details>
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
    <div className="min-w-0">
      <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground">{detail}</p>
    </div>
  )
}
