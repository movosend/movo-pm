"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { scopedApiUrl } from "@/lib/workspaces/routes"

const POLL_INTERVAL_MS = 60_000

/**
 * Backup sync path (preplan §2.5): Linear doesn't emit webhooks for
 * IssueRelation, so this is the only way blocking-relation changes ever
 * reach us. Runs only while the tab is visible.
 */
export function usePollingSync(enabled = true) {
  const router = useRouter()

  useEffect(() => {
    if (!enabled) return
    let interval: ReturnType<typeof setInterval> | null = null

    async function poll() {
      if (document.visibilityState !== "visible") return
      const res = await fetch(scopedApiUrl("/api/sync"), { method: "POST" })
      if (!res.ok) return
      const body = await res.json().catch(() => null)
      if (body?.changed) router.refresh()
    }

    function start() {
      if (interval) return
      interval = setInterval(poll, POLL_INTERVAL_MS)
    }
    function stop() {
      if (interval) clearInterval(interval)
      interval = null
    }
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        poll()
        start()
      } else {
        stop()
      }
    }

    document.addEventListener("visibilitychange", handleVisibility)
    if (document.visibilityState === "visible") start()

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility)
      stop()
    }
  }, [router, enabled])
}
