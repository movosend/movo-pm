import { NextResponse } from "next/server"
import { getLinearSource } from "@/lib/linear/client"
import { scopedHandler } from "@/lib/workspaces/api"

async function handleGET(request: Request) {
  const after = new URL(request.url).searchParams.get("after") ?? undefined
  try {
    return NextResponse.json(await getLinearSource().getTeamIssuesPage(after))
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los issues.",
      },
      { status: 502 }
    )
  }
}

export const GET = scopedHandler(handleGET)
