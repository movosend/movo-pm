import "server-only"
import { transferDecision } from "./transfer-decision"
import { mapConcurrent } from "./concurrency"
import { and, eq, inArray, isNull, lt, or } from "drizzle-orm"
import { db } from "@/lib/db/client"
import {
  planningTransfers as transfers,
  planningTransferItems as items,
} from "@/lib/db/schema"
import { getLinearSource } from "@/lib/linear/client"
import { requireStage, stageItems, teamKey } from "./store"
import { isPending, type TransferRow } from "./types"

export async function reviewTransfer(
  stageId: string,
  cycleId: string
): Promise<TransferRow[]> {
  await requireStage(stageId, true)
  const source = getLinearSource()
  const cycles = await source.getPlanningCycles()
  if (!cycles.some((cycle) => cycle.id === cycleId))
    throw new Error("El ciclo destino cambió o no está disponible.")
  const members = await stageItems(stageId)
  return mapConcurrent(members, async (member): Promise<TransferRow> => {
    try {
      const detail = await source.getIssueDetail(member.issueId, cycleId)
      const node = detail.nodes.find((node) => node.uuid === member.issueId)!
      const reason = node.isEpic
        ? "Es una épica"
        : !isPending(node)
          ? "Resuelta"
          : node.cycleId === cycleId
            ? "Ya está en el ciclo"
            : null
      return {
        issueId: member.issueId,
        identifier: node.id,
        title: node.title,
        beforeCycleId: node.cycleId ?? null,
        beforeCycleName: node.cycleName ?? null,
        points: node.pts,
        eligible: !reason,
        reason,
        selected: !reason && !node.cycleId,
        blockers: detail.blocks
          .filter(
            ([a, b]) =>
              b === node.id &&
              detail.nodes.some(
                (n) => n.id === a && isPending(n) && n.cycleId !== cycleId
              )
          )
          .map(([a]) => a),
      }
    } catch {
      return {
        issueId: member.issueId,
        identifier: member.identifier,
        title: member.identifier,
        beforeCycleId: null,
        beforeCycleName: null,
        points: null,
        eligible: false,
        selected: false,
        reason: "No se pudieron cargar sus datos",
        blockers: [],
      }
    }
  })
}
export async function createTransfer(
  stageId: string,
  cycleId: string,
  selected: { issueId: string; beforeCycleId: string | null }[],
  email: string,
  id: string
) {
  await requireStage(stageId, true)
  const [existing] = await db
    .select()
    .from(transfers)
    .where(eq(transfers.id, id))
  if (existing) {
    if (
      existing.stageId !== stageId ||
      existing.cycleId !== cycleId ||
      existing.createdBy !== email
    )
      throw new Error("La operación no corresponde a esta revisión.")
    const saved = await db.select().from(items).where(eq(items.transferId, id))
    if (
      saved.length !== selected.length ||
      saved.some(
        (item) =>
          !selected.some(
            (row) =>
              row.issueId === item.issueId &&
              row.beforeCycleId === item.beforeCycleId
          )
      )
    )
      throw new Error("La selección no coincide con la operación guardada.")
    return id
  }
  const rows = await reviewTransfer(stageId, cycleId)
  const selectedIds = new Set(selected.map((row) => row.issueId))
  const eligible = rows.filter((row) => selectedIds.has(row.issueId))
  if (
    !eligible.length ||
    eligible.length !== selectedIds.size ||
    eligible.some(
      (row) =>
        !row.eligible ||
        row.beforeCycleId !==
          selected.find((item) => item.issueId === row.issueId)?.beforeCycleId
    )
  ) {
    throw new Error(
      "La selección cambió desde la revisión. Volvé a revisar antes de trasladar."
    )
  }
  const cycle = (await getLinearSource().getPlanningCycles()).find(
    (cycle) => cycle.id === cycleId
  )
  if (!cycle) throw new Error("El ciclo destino ya no está disponible.")
  await db.batch([
    db.insert(transfers).values({
      id,
      stageId,
      cycleId,
      cycleName: cycle.name,
      createdBy: email,
    }),
    db
      .insert(items)
      .values(
        eligible.map((row) => ({
          transferId: id,
          issueId: row.issueId,
          identifier: row.identifier,
          beforeCycleId: row.beforeCycleId,
        }))
      )
      .onConflictDoNothing(),
  ])
  return id
}
export async function executeTransferItem(
  stageId: string,
  transferId: string,
  issueId: string,
  undo: boolean
) {
  await requireStage(stageId)
  const [transfer] = await db
    .select()
    .from(transfers)
    .where(and(eq(transfers.id, transferId), eq(transfers.stageId, stageId)))
  if (!transfer) throw new Error("No se encontró el traslado.")
  const [row] = await db
    .select()
    .from(items)
    .where(and(eq(items.transferId, transferId), eq(items.issueId, issueId)))
  if (!row) throw new Error("La issue no forma parte del traslado.")
  const allowed = undo
    ? ["done", "undo-failed", "undoing"]
    : ["pending", "failed", "applying"]
  if (!allowed.includes(row.status)) return row
  const token = crypto.randomUUID()
  const [claimed] = await db
    .update(items)
    .set({
      status: undo ? "undoing" : "applying",
      lockToken: token,
      lockedAt: new Date(),
      error: null,
    })
    .where(
      and(
        eq(items.id, row.id),
        inArray(items.status, allowed),
        or(
          isNull(items.lockedAt),
          lt(items.lockedAt, new Date(Date.now() - 120000))
        )
      )
    )
    .returning()
    .catch((error: unknown) => {
      if ((error as { cause?: { code?: string } }).cause?.code === "23505")
        throw new Error(
          "Hay otro traslado procesando esta issue. Retomá esa operación antes de iniciar otra."
        )
      throw error
    })
  if (!claimed)
    throw new Error(
      "Esta issue se está procesando. Esperá antes de reintentar."
    )
  const finish = async (status: string, error: string | null = null) => {
    const [result] = await db
      .update(items)
      .set({ status, error, lockedAt: null, lockToken: null })
      .where(and(eq(items.id, row.id), eq(items.lockToken, token)))
      .returning()
    return result
  }
  try {
    const source = getLinearSource()
    const detail = await source.getIssueDetail(issueId, transfer.cycleId)
    const node = detail.nodes.find((n) => n.uuid === issueId)!
    if (!node || node.isEpic !== false)
      throw new Error("La issue no es una unidad de trabajo.")
    if (!node.id.startsWith(`${teamKey()}-`))
      throw new Error("La issue ya no pertenece al equipo de esta hoja.")
    const target = undo ? row.beforeCycleId : transfer.cycleId
    const decision = transferDecision({
      current: node.cycleId ?? null,
      before: row.beforeCycleId,
      destination: transfer.cycleId,
      undo,
      attempted: row.attempted,
    })
    if (decision === "conflict")
      throw new Error(
        "Cambió de ciclo desde la revisión. Se conservó el cambio más reciente."
      )
    if (decision !== "write") return finish(decision)
    if (!undo) {
      if (!isPending(node))
        throw new Error(
          "La issue ya está resuelta. Volvé a revisar la selección."
        )
      if (
        !(await source.getPlanningCycles()).some(
          (cycle) => cycle.id === transfer.cycleId
        )
      )
        throw new Error("El ciclo destino cambió. Prepará un nuevo traslado.")
    }
    const latest = await source.getIssueValues(issueId)
    if (latest.cycleId !== (undo ? transfer.cycleId : row.beforeCycleId))
      throw new Error(
        "La asignación cambió mientras se procesaba. Se conservó el cambio más reciente."
      )
    // Persist intent before the external write so a lost response is recoverable.
    const intent = await db
      .update(items)
      .set({ attempted: true })
      .where(and(eq(items.id, row.id), eq(items.lockToken, token)))
      .returning()
    if (!intent.length) throw new Error("Otra solicitud retomó esta operación.")
    await source.updateIssue(issueId, { cycleId: target })
    return finish(undo ? "undone" : "done")
  } catch (error) {
    return finish(
      undo ? "undo-failed" : "failed",
      error instanceof Error ? error.message : "No se pudo completar el cambio."
    )
  }
}
