"use client"

import { useMemo, useSyncExternalStore } from "react"
import { decodeView, encodeView, type ViewState } from "@/lib/graph/view-state"
const EVENT = "graph-location-change"
function subscribe(callback: () => void) {
  window.addEventListener("popstate", callback)
  window.addEventListener(EVENT, callback)
  return () => {
    window.removeEventListener("popstate", callback)
    window.removeEventListener(EVENT, callback)
  }
}
export function useGraphLocation(cycleId: string) {
  const search = useSyncExternalStore(
    subscribe,
    () => window.location.search,
    () => ""
  )
  const state = useMemo(() => decodeView(new URLSearchParams(search)), [search])
  function update(patch: Partial<ViewState>) {
    const current = decodeView(new URLSearchParams(window.location.search))
    const params = encodeView(
      { ...current, ...patch, cycle: cycleId },
      new URLSearchParams(window.location.search)
    )
    const next = `${window.location.pathname}?${params}${window.location.hash}`
    if (
      next ===
      `${window.location.pathname}${window.location.search}${window.location.hash}`
    )
      return
    window.history.pushState(null, "", next)
    window.dispatchEvent(new Event(EVENT))
  }
  return { state, update }
}
