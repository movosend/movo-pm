import { and, eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db/client"
import { linearTeams, linearWorkspaces } from "@/lib/db/schema"
import { LEGACY_WORKSPACE_ID, requireAdmin } from "@/lib/workspaces/access"
import {
  encryptToken,
  exchangeCode,
  linearGraphql,
} from "@/lib/workspaces/linear-oauth"

type Discovery = {
  organization: {
    id: string
    name: string
    urlKey: string
    logoUrl: string | null
  }
  teams: {
    nodes: { id: string; key: string; name: string }[]
    pageInfo: { hasNextPage: boolean; endCursor: string | null }
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: "Acceso denegado." }, { status: 403 })
  }
  const state = request.nextUrl.searchParams.get("state")
  const code = request.nextUrl.searchParams.get("code")
  const verifier = request.cookies.get("linear_oauth_verifier")?.value
  if (
    !state ||
    !code ||
    !verifier ||
    state !== request.cookies.get("linear_oauth_state")?.value
  )
    return NextResponse.json(
      { error: "Autorización inválida o vencida." },
      { status: 400 }
    )
  try {
    const tokens = await exchangeCode(
      code,
      verifier,
      new URL("/api/linear/callback", request.url).toString()
    )
    const query = `query Discover($after: String) {
      organization { id name urlKey logoUrl }
      teams(first: 100, after: $after) { nodes { id key name } pageInfo { hasNextPage endCursor } }
    }`
    const first = await linearGraphql<Discovery>(tokens.access_token, query)
    if (!first.organization?.id || !first.organization.urlKey)
      throw new Error("Linear no devolvió el workspace.")
    const teams = [...first.teams.nodes]
    let page = first.teams
    while (page.pageInfo.hasNextPage && page.pageInfo.endCursor) {
      const next = await linearGraphql<Discovery>(tokens.access_token, query, {
        after: page.pageInfo.endCursor,
      })
      page = next.teams
      teams.push(...page.nodes)
    }
    const org = first.organization
    const [existing] = await db
      .select()
      .from(linearWorkspaces)
      .where(eq(linearWorkspaces.organizationId, org.id))
      .limit(1)
    const legacy =
      !existing && org.urlKey === "movosend"
        ? (
            await db
              .select()
              .from(linearWorkspaces)
              .where(eq(linearWorkspaces.id, LEGACY_WORKSPACE_ID))
              .limit(1)
          )[0]
        : null
    const credentials = {
      organizationId: org.id,
      name: org.name,
      slug: org.urlKey,
      logoUrl: org.logoUrl,
      accessToken: encryptToken(tokens.access_token),
      refreshToken: encryptToken(tokens.refresh_token),
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      connectionStatus: "connected",
    }
    const [workspace] =
      existing || legacy
        ? await db
            .update(linearWorkspaces)
            .set(credentials)
            .where(eq(linearWorkspaces.id, (existing ?? legacy)!.id))
            .returning()
        : await db.insert(linearWorkspaces).values(credentials).returning()
    for (const team of teams) {
      const [stored] = await db
        .select()
        .from(linearTeams)
        .where(
          and(
            eq(linearTeams.workspaceId, workspace.id),
            eq(linearTeams.key, team.key)
          )
        )
        .limit(1)
      if (stored)
        await db
          .update(linearTeams)
          .set({ linearTeamId: team.id, name: team.name })
          .where(eq(linearTeams.id, stored.id))
      else
        await db.insert(linearTeams).values({
          workspaceId: workspace.id,
          linearTeamId: team.id,
          key: team.key,
          name: team.name,
        })
    }
    const response = NextResponse.redirect(
      new URL("/settings/workspaces", request.url)
    )
    response.cookies.delete("linear_oauth_state")
    response.cookies.delete("linear_oauth_verifier")
    return response
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo conectar Linear.",
      },
      { status: 502 }
    )
  }
}
