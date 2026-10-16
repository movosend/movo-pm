import "server-only"
import { and, eq, ne, sql } from "drizzle-orm"
import { db } from "@/lib/db/client"
import {
  planningStages as stages,
  planningItems as items,
  planningTransfers as transfers,
  planningTransferItems as transferItems,
} from "@/lib/db/schema"
import { getLinearSource } from "@/lib/linear/client"
import type { MembershipChange } from "./types"

export const teamKey = () => process.env.LINEAR_TEAM_KEY!
export async function requireStage(id: string, editable = false) {
  const [stage] = await db
    .select()
    .from(stages)
    .where(and(eq(stages.id, id), eq(stages.teamKey, teamKey())))
  if (!stage || (editable && stage.archived))
    throw new Error("La hoja no está disponible.")
  return stage
}
export async function stageItems(id: string) {
  return db
    .select()
    .from(items)
    .where(and(eq(items.stageId, id), eq(items.included, true)))
}
export async function listStages() {
  return db
    .select()
    .from(stages)
    .where(eq(stages.teamKey, teamKey()))
    .orderBy(stages.updatedAt)
}
export async function createStage(
  name: string,
  email: string,
  sourceId?: string
) {
  const sourceItems = sourceId
    ? (await requireStage(sourceId), await stageItems(sourceId))
    : []
  const id = crypto.randomUUID()
  if (sourceItems.length) {
    await db.batch([
      db
        .insert(stages)
        .values({ id, name, teamKey: teamKey(), createdBy: email }),
      db.insert(items).values(
        sourceItems.map((item) => ({
          stageId: id,
          issueId: item.issueId,
          identifier: item.identifier,
        }))
      ),
    ])
  } else
    await db
      .insert(stages)
      .values({ id, name, teamKey: teamKey(), createdBy: email })
  return requireStage(id)
}
export async function editStage(
  id: string,
  version: number,
  patch: { name?: string; archived?: boolean }
) {
  await requireStage(id)
  const [result] = await db
    .update(stages)
    .set({
      ...patch,
      version: sql`${stages.version} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(stages.id, id), eq(stages.version, version)))
    .returning()
  if (!result)
    throw new Error(
      "Otra persona cambió la hoja. Actualizá antes de volver a guardar."
    )
  return result
}
export async function changeMembership(
  stageId: string,
  ids: string[],
  included: boolean
) {
  await requireStage(stageId, true)
  const changes: MembershipChange[] = []
  const errors: string[] = []
  for (const id of [...new Set(ids)]) {
    try {
      let issueId = id,
        identifier = id
      if (included) {
        const detail = await getLinearSource().getIssueDetail(id, "")
        const node = detail.nodes.find(
          (node) => node.id === id || node.uuid === id
        )
        if (!node?.uuid || node.isEpic !== false)
          throw new Error("Elegí una subissue de trabajo, no una épica.")
        if (!node.id.startsWith(`${teamKey()}-`))
          throw new Error("La issue pertenece a otro equipo.")
        issueId = node.uuid
        identifier = node.id
      } else {
        const existing = (await stageItems(stageId)).find(
          (item) => item.issueId === id || item.identifier === id
        )
        if (!existing) continue
        issueId = existing.issueId
        identifier = existing.identifier
      }
      const token = crypto.randomUUID()
      const [changed] = await db
        .insert(items)
        .values({ stageId, issueId, identifier, included, token })
        .onConflictDoUpdate({
          target: [items.stageId, items.issueId],
          set: { included, token },
          setWhere: ne(items.included, included),
        })
        .returning()
      if (changed)
        changes.push({ issueId, identifier, before: !included, token })
    } catch (error) {
      errors.push(
        `${id}: ${error instanceof Error ? error.message : "No se pudo guardar"}`
      )
    }
  }
  await db
    .update(stages)
    .set({ updatedAt: new Date() })
    .where(eq(stages.id, stageId))
  return { changes, errors, items: await stageItems(stageId) }
}
export async function undoMembership(
  stageId: string,
  changes: MembershipChange[]
) {
  await requireStage(stageId, true)
  let skipped = 0
  for (const change of changes) {
    if (change.before) {
      try {
        const detail = await getLinearSource().getIssueDetail(
          change.issueId,
          ""
        )
        const node = detail.nodes.find((node) => node.uuid === change.issueId)
        if (
          !node ||
          node.isEpic !== false ||
          !node.id.startsWith(`${teamKey()}-`)
        ) {
          skipped++
          continue
        }
      } catch {
        skipped++
        continue
      }
    }
    // Only reverse the exact write; never erase a newer collaborator action.
    const result = await db
      .update(items)
      .set({ included: change.before, token: crypto.randomUUID() })
      .where(
        and(
          eq(items.stageId, stageId),
          eq(items.issueId, change.issueId),
          eq(items.token, change.token),
          eq(items.included, !change.before)
        )
      )
      .returning()
    if (!result.length) skipped++
  }
  return { skipped, items: await stageItems(stageId) }
}
export async function getTransfers(stageId: string) {
  const rows = await db
    .select()
    .from(transfers)
    .where(eq(transfers.stageId, stageId))
    .orderBy(transfers.createdAt)
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      items: await db
        .select()
        .from(transferItems)
        .where(eq(transferItems.transferId, row.id)),
    }))
  )
}
