"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { SparkleIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

const STEPS = [
  "Leyendo el snapshot del ciclo…",
  "Revisando bloqueos y dependencias…",
  "Detectando cuellos de botella…",
  "Redactando decisiones y riesgos…",
  "Puliendo el resumen…",
]

export function AnalyzeButton({ hasAnalysis }: { hasAnalysis: boolean }) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!isPending) return
    const stepId = setInterval(
      () => setStep((s) => Math.min(s + 1, STEPS.length - 1)),
      2600
    )
    const tickId = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => {
      clearInterval(stepId)
      clearInterval(tickId)
    }
  }, [isPending])

  async function handleGenerate() {
    setIsPending(true)
    setError(null)
    setStep(0)
    setElapsed(0)
    const res = await fetch("/api/analysis", { method: "POST" })
    setIsPending(false)
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      setError(body?.error ?? "No se pudo generar el análisis.")
      return
    }
    router.refresh()
  }

  if (isPending) {
    return (
      <div className="mb-6 flex flex-col gap-2.5 rounded-lg border bg-muted/30 px-3.5 py-3">
        <div className="flex items-center gap-2.5">
          <SparkleIcon className="size-4 shrink-0 animate-pulse text-foreground" />
          <p
            key={step}
            className="animate-in fade-in slide-in-from-bottom-1 min-w-0 flex-1 truncate text-xs font-medium duration-300"
          >
            {STEPS[step]}
          </p>
          <span className="shrink-0 text-[10.5px] tabular-nums text-muted-foreground">
            {elapsed}s
          </span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/3 rounded-full bg-foreground/70 [animation:loading-sweep_1.3s_ease-in-out_infinite]" />
        </div>
      </div>
    )
  }

  return (
    <div className="mb-6 flex flex-col gap-2">
      <Button size="sm" variant="outline" onClick={handleGenerate}>
        <SparkleIcon data-icon="inline-start" />
        {hasAnalysis ? "Actualizar análisis" : "Generar análisis"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
