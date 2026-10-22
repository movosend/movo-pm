import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { z } from "zod"
import { requireStage, stageItems } from "@/lib/planning/store"
import { getLinearSource } from "@/lib/linear/client"
import { mapConcurrent } from "@/lib/planning/concurrency"
import { buildStagePreview } from "@/lib/planning/preview"
import { scopedHandler } from "@/lib/workspaces/api"

export const maxDuration = 300
async function handleGET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await auth())?.user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const parsed = z
    .string()
    .uuid()
    .safeParse((await params).id)
  if (!parsed.success)
    return NextResponse.json({ error: "Hoja inválida" }, { status: 400 })
  try {
    await requireStage(parsed.data)
    const items = await stageItems(parsed.data)
    const details = await mapConcurrent(
      items,
      (item) => getLinearSource().getIssueDetail(item.issueId, "planning"),
      3
    )
    return NextResponse.json(
      buildStagePreview(
        items.map((item) => item.identifier),
        details
      ),
      { headers: { "Cache-Control": "private, no-store" } }
    )
  } catch {
    return NextResponse.json(
      { error: "No se pudo cargar la vista previa" },
      { status: 503 }
    )
  }
}
export const GET = scopedHandler(handleGET)
