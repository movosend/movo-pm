import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { z } from "zod"
import {
  changeMembership,
  editStage,
  getTransfers,
  requireStage,
  stageItems,
  undoMembership,
} from "@/lib/planning/store"
import { getLinearSource } from "@/lib/linear/client"
import {
  createTransfer,
  executeTransferItem,
  reviewTransfer,
} from "@/lib/planning/transfers"
import { editDependency } from "@/lib/planning/dependencies"
import { runSync } from "@/lib/sync/run-sync"
const ids = z.array(z.string().min(1).max(150)).min(1).max(100)
const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("dependency"),
    sourceId: z.string().min(1).max(150),
    targetId: z.string().min(1).max(150),
    direction: z.enum(["blocks", "blockedBy"]),
    requestId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("removeDependency"),
    sourceId: z.string().min(1).max(150),
    removeId: z.string().uuid(),
  }),
  z.object({
    action: z.literal("edit"),
    version: z.number().int().positive(),
    name: z.string().trim().min(1).max(100).optional(),
    archived: z.boolean().optional(),
  }),
  z.object({ action: z.literal("membership"), ids, included: z.boolean() }),
  z.object({
    action: z.literal("undo"),
    changes: z
      .array(
        z.object({
          issueId: z.string(),
          identifier: z.string(),
          before: z.boolean(),
          token: z.string().uuid(),
        })
      )
      .max(100),
  }),
  z.object({ action: z.literal("review"), cycleId: z.string().min(1) }),
  z.object({
    action: z.literal("transfer"),
    requestId: z.string().uuid(),
    cycleId: z.string().min(1),
    selected: z
      .array(
        z.object({ issueId: z.string(), beforeCycleId: z.string().nullable() })
      )
      .min(1)
      .max(100),
  }),
  z.object({
    action: z.literal("execute"),
    transferId: z.string().uuid(),
    issueId: z.string(),
    undo: z.boolean().default(false),
  }),
  z.object({ action: z.literal("sync") }),
])
type Context = { params: Promise<{ id: string }> }
export async function GET(_request: Request, { params }: Context) {
  if (!(await auth())?.user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success)
    return NextResponse.json({ error: "Hoja inválida" }, { status: 400 })
  try {
    const stage = await requireStage(id)
    const [items, transfers, cycles] = await Promise.all([
      stageItems(id),
      getTransfers(id),
      getLinearSource().getPlanningCycles(),
    ])
    return NextResponse.json({ stage, items, transfers, cycles })
  } catch (error) {
    return failure(error)
  }
}
export async function POST(request: Request, { params }: Context) {
  const session = await auth()
  if (!session?.user?.email)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const { id } = await params
  const parsed = actionSchema.safeParse(await request.json().catch(() => null))
  if (!z.string().uuid().safeParse(id).success || !parsed.success)
    return NextResponse.json(
      { error: "La operación no es válida." },
      { status: 400 }
    )
  const body = parsed.data
  try {
    await requireStage(id)
    switch (body.action) {
      case "dependency":
      case "removeDependency":
        return NextResponse.json(await editDependency(id, body))
      case "edit":
        return NextResponse.json({
          stage: await editStage(id, body.version, {
            ...(body.name !== undefined ? { name: body.name } : {}),
            ...(body.archived !== undefined ? { archived: body.archived } : {}),
          }),
        })
      case "membership":
        return NextResponse.json(
          await changeMembership(id, body.ids, body.included)
        )
      case "undo":
        return NextResponse.json(await undoMembership(id, body.changes))
      case "review":
        return NextResponse.json({
          rows: await reviewTransfer(id, body.cycleId),
        })
      case "transfer":
        return NextResponse.json({
          id: await createTransfer(
            id,
            body.cycleId,
            body.selected,
            session.user.email,
            body.requestId
          ),
        })
      case "execute":
        return NextResponse.json({
          item: await executeTransferItem(
            id,
            body.transferId,
            body.issueId,
            body.undo
          ),
        })
      case "sync": {
        try {
          await runSync("manual")
          return NextResponse.json({ synced: true })
        } catch {
          return NextResponse.json({
            synced: false,
            error:
              "Los cambios se guardaron. Falta actualizar el ciclo; podés reintentar la sincronización.",
          })
        }
      }
    }
  } catch (error) {
    return failure(error)
  }
}
function failure(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof Error ? error.message : "No se pudo guardar la hoja.",
    },
    { status: 409 }
  )
}
export const maxDuration = 300
