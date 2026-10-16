import type { IssueUpdateInput, UpdateResult } from "@/lib/schema/issue-update"

export class PatchIssueError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message)
  }
}
export async function patchIssue(
  issueId: string,
  input: IssueUpdateInput,
  expected?: IssueUpdateInput
): Promise<UpdateResult> {
  const res = await fetch("/api/issues", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ issueId, input, ...(expected ? { expected } : {}) }),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok)
    throw new PatchIssueError(
      body?.error ?? "No se pudo actualizar la issue.",
      res.status
    )
  return body
}
