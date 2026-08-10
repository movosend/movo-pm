"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { RefreshCwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

export function SyncButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const busy = syncing || isPending

  async function handleSync() {
    setError(null)
    setSyncing(true)
    try {
      const res = await fetch("/api/sync", { method: "POST" })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error ?? "No se pudo sincronizar.")
        return
      }
      startTransition(() => router.refresh())
    } finally {
      setSyncing(false)
    }
  }

  if (compact) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={busy}
          title="Sincronizar con Linear"
        >
          <RefreshCwIcon
            data-icon="inline-start"
            className={busy ? "animate-spin" : undefined}
          />
          Sincronizar
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button onClick={handleSync} disabled={busy}>
        <RefreshCwIcon
          data-icon="inline-start"
          className={busy ? "animate-spin" : undefined}
        />
        Sincronizar con Linear
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
