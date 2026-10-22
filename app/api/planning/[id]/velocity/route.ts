import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { getLinearSource } from "@/lib/linear/client"
import { requireStage } from "@/lib/planning/store"
import { z } from "zod"
import { scopedHandler } from "@/lib/workspaces/api"
async function handleGET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await auth())?.user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success)
    return NextResponse.json({ error: "Hoja inválida" }, { status: 400 })
  try {
    await requireStage(id)
    return NextResponse.json(await getLinearSource().getVelocity())
  } catch {
    return NextResponse.json(
      { error: "No se pudo consultar la velocidad del equipo." },
      { status: 502 }
    )
  }
}
export const GET = scopedHandler(handleGET)
