import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"

import { listRecentAnalyses } from "@/lib/db/queries"
import { checkAnalysisRateLimit } from "@/lib/analysis/rate-limit"
import { estimateCostUsd } from "@/lib/analysis/pricing"
import { getRealCostSummary } from "@/lib/analysis/admin-usage"
import { auth } from "@/auth"
import { isAdmin } from "@/lib/workspaces/access"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Usage",
}

function formatUsd(value: number) {
  return value.toLocaleString("es-AR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })
}

function startOfMonth() {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

async function loadRealMonthCost(monthStart: Date) {
  try {
    const summary = await getRealCostSummary(monthStart)
    return { summary, error: null as string | null }
  } catch {
    return {
      summary: null,
      error: "No se pudo consultar la Admin API de Anthropic.",
    }
  }
}

export default async function UsagePage() {
  if (!isAdmin((await auth())?.user?.id)) return null
  const monthStart = startOfMonth()

  const [analyses, rateLimit, realCost] = await Promise.all([
    listRecentAnalyses(200),
    checkAnalysisRateLimit(),
    loadRealMonthCost(monthStart),
  ])

  const rows = analyses.map((a) => ({
    ...a,
    cost: estimateCostUsd(a.model, a.inputTokens ?? 0, a.outputTokens ?? 0),
  }))

  const monthRows = rows.filter((r) => r.generatedAt >= monthStart)
  const monthCost = monthRows.reduce((sum, r) => sum + r.cost, 0)
  const totalCost = rows.reduce((sum, r) => sum + r.cost, 0)
  const totalTokens = rows.reduce(
    (sum, r) => sum + (r.inputTokens ?? 0) + (r.outputTokens ?? 0),
    0
  )

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 overflow-y-auto p-6">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        render={<Link href="/settings" />}
        nativeButton={false}
      >
        <ArrowLeftIcon />
        Volver
      </Button>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Regeneraciones hoy</CardDescription>
            <CardTitle>
              {rateLimit.usedToday} / {rateLimit.limit}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Costo estimado este mes</CardDescription>
            <CardTitle>{formatUsd(monthCost)}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardHeader>
            <CardDescription>
              Costo estimado (últimas {rows.length} corridas)
            </CardDescription>
            <CardTitle>{formatUsd(totalCost)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Costo real (Anthropic)</CardTitle>
          <CardDescription>
            Anthropic solo publica el costo final de un día una vez que
            termina (UTC), así que el total combina el costo ya facturado de
            los días cerrados de este mes con un estimado de hoy calculado
            sobre el uso real medido por Anthropic minuto a minuto. Ninguna
            llamada a la API expone el saldo o crédito disponible en la
            cuenta — eso solo se ve en la consola de Anthropic.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {realCost.summary && (
            <div className="flex flex-col gap-1">
              <div className="font-heading text-2xl font-medium">
                {formatUsd(realCost.summary.totalUsd)}
              </div>
              <div className="text-sm text-muted-foreground">
                {formatUsd(realCost.summary.closedDaysUsd)} en días cerrados
                {" + "}
                {formatUsd(realCost.summary.todayEstimateUsd)} estimado de hoy
              </div>
            </div>
          )}
          {!realCost.summary && realCost.error && (
            <p className="text-sm text-destructive">{realCost.error}</p>
          )}
          {!realCost.summary && !realCost.error && (
            <p className="text-sm text-muted-foreground">
              No configurada. Agregá <code>ANTHROPIC_ADMIN_API_KEY</code> (una
              Admin API key, distinta de la key de inferencia) para ver acá el
              costo real facturado por Anthropic.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de análisis</CardTitle>
          <CardDescription>
            Estimado en base al pricing público de Anthropic para{" "}
            {rows[0]?.model ?? "el modelo configurado"} ({totalTokens.toLocaleString(
              "es-AR"
            )}{" "}
            tokens totales). No refleja el saldo o crédito disponible en la
            cuenta de Anthropic — para eso hay que revisar la consola de
            Anthropic directamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="pb-2 font-normal">Fecha</th>
                <th className="pb-2 font-normal">Modelo</th>
                <th className="pb-2 font-normal">Tokens in</th>
                <th className="pb-2 font-normal">Tokens out</th>
                <th className="pb-2 font-normal">Costo est.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="py-1.5 whitespace-nowrap">
                    {r.generatedAt.toLocaleString("es-AR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="py-1.5">{r.model}</td>
                  <td className="py-1.5">
                    {(r.inputTokens ?? 0).toLocaleString("es-AR")}
                  </td>
                  <td className="py-1.5">
                    {(r.outputTokens ?? 0).toLocaleString("es-AR")}
                  </td>
                  <td className="py-1.5">{formatUsd(r.cost)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-2 text-center text-muted-foreground"
                  >
                    Todavía no hay análisis generados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
