import { NextResponse } from "next/server"
import { requireTeam } from "./access"
import { withTeamContext } from "./context"

type Handler<C> = (request: Request, context: C) => Promise<Response>

export function scopedHandler<C>(handler: Handler<C>): Handler<C> {
  return async (request, context) => {
    const url = new URL(request.url)
    const teamId = url.searchParams.get("teamId")
    const workspaceId = url.searchParams.get("workspaceId")
    if (!teamId || !workspaceId)
      return NextResponse.json(
        { error: "Falta seleccionar un equipo." },
        { status: 400 }
      )
    let team
    try {
      team = await requireTeam(teamId, workspaceId)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Acceso denegado." },
        { status: 403 }
      )
    }
    return withTeamContext(team, () => handler(request, context))
  }
}
