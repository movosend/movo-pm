import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { getLinearSource } from "@/lib/linear/client"
import { runSync } from "@/lib/sync/run-sync"
import { issueRequestSchema } from "@/lib/schema/issue-update"
import {
  IssueConflictError,
  updateIssueWithReceipt,
} from "@/lib/api/update-issue"

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const body = issueRequestSchema.safeParse(
    await request.json().catch(() => null)
  )
  if (!body.success)
    return NextResponse.json(
      { error: "Los cambios no son válidos." },
      { status: 400 }
    )
  try {
    const { issueId, input, expected } = body.data
    const result = await updateIssueWithReceipt(
      getLinearSource(),
      () => runSync("manual"),
      issueId,
      input,
      expected
    )
    return NextResponse.json(result)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo actualizar la issue."
    return NextResponse.json(
      { error: message },
      { status: error instanceof IssueConflictError ? 409 : 502 }
    )
  }
}
