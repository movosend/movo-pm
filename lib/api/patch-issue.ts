export async function patchIssue(
  issueId: string,
  input: { assigneeId?: string | null; stateId?: string; cycleId?: string }
) {
  const res = await fetch("/api/issues", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ issueId, ...input }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error ?? "No se pudo actualizar la issue.")
  }
}
