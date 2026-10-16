import type {
  IssueUpdateInput,
  IssueValues,
  UpdateResult,
} from "@/lib/schema/issue-update"

export class IssueConflictError extends Error {}
export type UpdateSource = {
  getIssueValues(id: string): Promise<IssueValues>
  updateIssue(id: string, input: IssueUpdateInput): Promise<void>
}
export async function updateIssueWithReceipt(
  source: UpdateSource,
  sync: () => Promise<unknown>,
  issueId: string,
  input: IssueUpdateInput,
  expected?: IssueUpdateInput
): Promise<UpdateResult> {
  const current = await source.getIssueValues(issueId)
  if (
    expected &&
    Object.entries(expected).some(
      ([key, value]) => current[key as keyof IssueValues] !== value
    )
  ) {
    throw new IssueConflictError(
      "La issue cambió después. No se deshizo para conservar ese cambio."
    )
  }
  const before = Object.fromEntries(
    Object.keys(input).map((key) => [key, current[key as keyof IssueValues]])
  ) as IssueUpdateInput
  await source.updateIssue(issueId, input)
  try {
    await sync()
    return { issueId, before, after: input, synced: true }
  } catch {
    return {
      issueId,
      before,
      after: input,
      synced: false,
      syncError:
        "El cambio se guardó en Linear, pero no se pudo sincronizar. Podés sincronizar nuevamente o deshacer.",
    }
  }
}
