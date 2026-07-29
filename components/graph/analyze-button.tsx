"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { SparkleIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

export function AnalyzeButton({ hasAnalysis }: { hasAnalysis: boolean }) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    setIsPending(true)
    setError(null)
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
      <div className="mb-6 flex flex-col gap-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-16 w-full" />
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
