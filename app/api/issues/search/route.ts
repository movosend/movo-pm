import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { getLinearSource } from "@/lib/linear/client"
import { scopedHandler } from "@/lib/workspaces/api"

async function handleGET(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const term = new URL(request.url).searchParams.get("q")?.trim() ?? ""
  if (term.length < 2) {
    return NextResponse.json({ results: [] })
  }

  try {
    const results = await getLinearSource().searchIssues(term)
    return NextResponse.json({ results })
  } catch (error) {
    const message = error instanceof Error ? error.message : "search failed"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
export const GET = scopedHandler(handleGET)
