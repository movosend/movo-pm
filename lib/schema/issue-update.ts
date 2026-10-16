import { z } from "zod"

export const issueUpdateSchema = z
  .object({
    assigneeId: z.string().min(1).nullable().optional(),
    stateId: z.string().min(1).optional(),
    cycleId: z.string().min(1).nullable().optional(),
    estimate: z.number().finite().nonnegative().nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "No hay cambios")
export type IssueUpdateInput = z.infer<typeof issueUpdateSchema>
export type IssueValues = {
  assigneeId: string | null
  stateId: string
  cycleId: string | null
  estimate: number | null
}
export type ChangeReceipt = {
  issueId: string
  before: IssueUpdateInput
  after: IssueUpdateInput
}
export type UpdateResult = ChangeReceipt & {
  synced: boolean
  syncError?: string
}
export const issueRequestSchema = z
  .object({
    issueId: z.string().min(1).max(150),
    input: issueUpdateSchema,
    expected: issueUpdateSchema.optional(),
  })
  .strict()
  .refine(
    ({ input, expected }) =>
      !expected ||
      Object.keys(input).sort().join() === Object.keys(expected).sort().join(),
    "Los campos de la reversión no coinciden"
  )
