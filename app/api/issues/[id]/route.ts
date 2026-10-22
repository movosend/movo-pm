import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { getLinearSource } from "@/lib/linear/client"
import { scopedHandler } from "@/lib/workspaces/api"

async function handleGET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const { id } = await params
  const cycleId = new URL(request.url).searchParams.get("cycle")
  if (!id || !cycleId)
    return NextResponse.json(
      { error: "Falta la issue o el ciclo." },
      { status: 400 }
    )
  try {
    const detail = await getLinearSource().getIssueDetail(id, cycleId)
    return NextResponse.json(detail)
  } catch {
    return NextResponse.json(
      { error: "No se pudo cargar la issue desde Linear." },
      { status: 502 }
    )
  }
}
export const GET = scopedHandler(handleGET)
