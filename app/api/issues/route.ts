import { NextResponse } from "next/server"

import { auth } from "@/auth"
import { getLinearSource, type IssueUpdateInput } from "@/lib/linear/client"
import { runSync } from "@/lib/sync/run-sync"

type RequestBody = {
  issueId?: unknown
  assigneeId?: unknown
  stateId?: unknown
  cycleId?: unknown
}

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as RequestBody | null
  const issueId = typeof body?.issueId === "string" ? body.issueId : null
  if (!issueId) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 })
  }

  const input: IssueUpdateInput = {}
  if ("assigneeId" in (body ?? {})) {
    input.assigneeId =
      typeof body?.assigneeId === "string" ? body.assigneeId : null
  }
  if (typeof body?.stateId === "string") input.stateId = body.stateId
  if (typeof body?.cycleId === "string") input.cycleId = body.cycleId

  if (Object.keys(input).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 })
  }

  try {
    await getLinearSource().updateIssue(issueId, input)
    const result = await runSync("manual")
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : "update failed"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
