import "server-only"
import { getLinearSource } from "@/lib/linear/client"
import { requireStage, stageItems, teamKey } from "./store"

export async function editDependency(
  stageId: string,
  input: {
    sourceId: string
    targetId?: string
    direction?: "blocks" | "blockedBy"
    requestId?: string
    removeId?: string
  }
) {
  await requireStage(stageId, true)
  const source = getLinearSource()
  const detail = await source.getIssueDetail(input.sourceId, "planning")
  const root = detail.nodes.find(
    (node) => node.id === input.sourceId || node.uuid === input.sourceId
  )
  if (!root?.uuid || root.isEpic !== false)
    throw new Error("Elegí una US de trabajo.")
  if (!(await stageItems(stageId)).some((item) => item.issueId === root.uuid))
    throw new Error("Primero agregá la US al plan.")
  if (!root.id.startsWith(`${teamKey()}-`))
    throw new Error("La US ya no pertenece al equipo.")
  if (input.removeId) {
    const relation = detail.blockingRelations?.find(
      (relation) => relation.id === input.removeId
    )
    if (!relation) return { changed: false }
    await source.deleteDependency(relation.id)
    return { changed: true }
  }
  if (!input.targetId || !input.direction || !input.requestId)
    throw new Error("Elegí la otra US y la dirección del bloqueo.")
  const targetDetail = await source.getIssueDetail(input.targetId, "planning")
  const target = targetDetail.nodes.find(
    (node) => node.id === input.targetId || node.uuid === input.targetId
  )
  if (!target?.uuid || target.isEpic !== false)
    throw new Error("Las épicas son contexto. Elegí una US de trabajo.")
  if (!target.id.startsWith(`${teamKey()}-`))
    throw new Error("Elegí una US del mismo equipo.")
  if (target.uuid === root.uuid)
    throw new Error("Una US no puede bloquearse a sí misma.")
  const [blocker, blocked] =
    input.direction === "blocks" ? [root, target] : [target, root]
  if (detail.blocks.some(([a, b]) => a === blocker.id && b === blocked.id))
    return { changed: false }
  if (detail.blocks.some(([a, b]) => a === blocked.id && b === blocker.id))
    throw new Error(
      "Ya existe el bloqueo inverso. Quitalo antes de invertir la dirección."
    )
  try {
    await source.createDependency(input.requestId, blocker.uuid!, blocked.uuid!)
  } catch (error) {
    // A retry after a lost response must not create a duplicate relation.
    const latest = await source.getIssueDetail(root.uuid, "planning")
    if (!latest.blocks.some(([a, b]) => a === blocker.id && b === blocked.id))
      throw error
  }
  return { changed: true }
}
