import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { z } from "zod"
import { createStage, listStages } from "@/lib/planning/store"
import { scopedHandler } from "@/lib/workspaces/api"
async function handleGET() {
  if (!(await auth())?.user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  return NextResponse.json({ stages: await listStages() })
}
async function handlePOST(request: Request) {
  const session = await auth()
  if (!session?.user?.email)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const parsed = z
    .object({
      name: z.string().trim().min(1).max(100),
      sourceId: z.string().uuid().optional(),
    })
    .safeParse(await request.json().catch(() => null))
  if (!parsed.success)
    return NextResponse.json(
      { error: "El nombre no es válido." },
      { status: 400 }
    )
  try {
    return NextResponse.json({
      stage: await createStage(
        parsed.data.name,
        session.user.email,
        parsed.data.sourceId
      ),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "No se pudo crear la hoja.",
      },
      { status: 409 }
    )
  }
}
export const GET = scopedHandler(handleGET)
export const POST = scopedHandler(handlePOST)
