"use client"

import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useRouter } from "next/navigation"
import { patchIssue, PatchIssueError } from "@/lib/api/patch-issue"
import type { ChangeReceipt, IssueUpdateInput } from "@/lib/schema/issue-update"
import { Toaster, createToastManager } from "@/components/ui/toast"

const UpdatesContext = createContext<{
  mutate: (id: string, input: IssueUpdateInput) => Promise<void>
  busy: Set<string>
  notify: (message: string, type?: "success" | "error") => void
} | null>(null)
const LABELS: Record<string, string> = {
  stateId: "Estado actualizado",
  assigneeId: "Responsable actualizado",
  estimate: "Puntos actualizados",
  cycleId: "Ciclo actualizado",
}
export function IssueUpdatesProvider({
  children,
  onUpdated,
}: {
  children: ReactNode
  onUpdated?: () => void
}) {
  const router = useRouter()
  const [manager] = useState(() => createToastManager())
  const locks = useRef(new Set<string>())
  const [busy, setBusy] = useState(new Set<string>())
  const receipts = useRef(new Map<string, ChangeReceipt>())
  function invalidate(id: string, input: IssueUpdateInput) {
    for (const [toastId, receipt] of receipts.current) {
      if (
        receipt.issueId === id &&
        Object.keys(input).some((key) => key in receipt.after)
      ) {
        manager.close(toastId)
        receipts.current.delete(toastId)
      }
    }
  }
  async function run(
    id: string,
    input: IssueUpdateInput,
    undo?: { toastId: string; receipt: ChangeReceipt }
  ) {
    if (locks.current.has(id))
      throw new Error("Esperá a que termine el cambio anterior.")
    locks.current.add(id)
    setBusy(new Set(locks.current))
    try {
      const result = await patchIssue(id, input, undo?.receipt.after)
      invalidate(id, input)
      router.refresh()
      onUpdated?.()
      if (undo) {
        manager.add({
          title: `${id} · Cambio deshecho`,
          description: result.syncError,
          type: result.synced ? "success" : "warning",
        })
      } else {
        const toastId = manager.add({
          title: `${id} · ${LABELS[Object.keys(input)[0]] ?? "Issue actualizada"}`,
          description: result.syncError,
          type: result.synced ? "success" : "warning",
          timeout: 15000,
          onClose: () => {
            receipts.current.delete(toastId)
          },
          actionProps: {
            children: "Deshacer",
            onClick: () => {
              const receipt = receipts.current.get(toastId)
              if (receipt)
                void run(id, receipt.before, { toastId, receipt }).catch(
                  () => {}
                )
            },
          },
        })
        receipts.current.set(toastId, result)
      }
    } catch (error) {
      const conflict = error instanceof PatchIssueError && error.status === 409
      if (conflict && undo) {
        manager.close(undo.toastId)
        receipts.current.delete(undo.toastId)
        router.refresh()
      }
      const errorToastId = manager.add({
        title: conflict
          ? "No se pudo deshacer"
          : "No se pudo guardar el cambio",
        description:
          error instanceof Error ? error.message : "Intentá nuevamente.",
        type: "error",
        timeout: 15000,
        ...(!conflict
          ? {
              actionProps: {
                children: "Reintentar",
                onClick: () => {
                  manager.close(errorToastId)
                  void run(id, input, undo).catch(() => {})
                },
              },
            }
          : {}),
      })
      throw error
    } finally {
      locks.current.delete(id)
      setBusy(new Set(locks.current))
    }
  }
  return (
    <UpdatesContext.Provider
      value={{
        mutate: run,
        busy,
        notify: (message, type = "success") => {
          manager.add({
            id: "clipboard",
            title: message,
            type,
            timeout: type === "error" ? 5000 : 2500,
          })
        },
      }}
    >
      <Toaster toastManager={manager} limit={8}>
        {children}
      </Toaster>
    </UpdatesContext.Provider>
  )
}
export function useIssueUpdates() {
  const context = useContext(UpdatesContext)
  if (!context) throw new Error("Falta IssueUpdatesProvider")
  return context
}
