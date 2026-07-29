"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { RefreshCwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

export function SyncButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  async function handleSync() {
    setError(null)
    const res = await fetch("/api/sync", { method: "POST" })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      setError(body?.error ?? "No se pudo sincronizar.")
      return
    }
    startTransition(() => router.refresh())
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button onClick={handleSync} disabled={isPending}>
        <RefreshCwIcon data-icon="inline-start" />
        Sincronizar con Linear
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
