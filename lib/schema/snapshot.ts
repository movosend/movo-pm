import { z } from "zod"

export const issueTypeSchema = z.enum([
  "completed",
  "started",
  "unstarted",
  "backlog",
  "canceled",
])

export const nodeSchema = z.object({
  id: z.string(),
  short: z.string(),
  title: z.string(),
  status: z.string(),
  type: issueTypeSchema,
  pts: z.number().nullable(),
  who: z.string().nullable(),
  parent: z.string().nullable(),
  inCycle: z.boolean(),
  /**
   * Additive to the mockup's original contract — needed for M3's keyword
   * extraction of external-dependency signals (preplan §2.6). Never sent to
   * the model directly; only extractSignals() reads it, and only its
   * short output goes into the analysis prompt.
   */
  description: z.string().nullable(),
  assigneeId: z.string().nullable(),
  stateId: z.string().nullable(),
})

export const blockSchema = z.tuple([z.string(), z.string()])

export const cycleSchema = z.object({
  id: z.string(),
  number: z.number(),
  team: z.string(),
  name: z.string(),
  start: z.string(),
  end: z.string(),
  taken: z.string(),
  live: z.boolean(),
  workspace: z.string(),
})

export const teamStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: issueTypeSchema,
})

export const teamMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
})

export const decisionSchema = z.object({
  sev: z.enum(["alta", "media", "baja"]),
  title: z.string(),
  body: z.string(),
  issues: z.array(z.string()),
})

export const analysisSchema = z.object({
  generated: z.string(),
  headline: z.string(),
  decisions: z.array(decisionSchema).max(6),
  watchNext: z.array(z.string()),
})

export const snapshotSchema = z.object({
  cycle: cycleSchema,
  analysis: analysisSchema.nullable(),
  nodes: z.array(nodeSchema),
  blocks: z.array(blockSchema),
  states: z.array(teamStateSchema),
  members: z.array(teamMemberSchema),
})

export type IssueType = z.infer<typeof issueTypeSchema>
export type Node = z.infer<typeof nodeSchema>
export type Block = z.infer<typeof blockSchema>
export type Cycle = z.infer<typeof cycleSchema>
export type TeamState = z.infer<typeof teamStateSchema>
export type TeamMember = z.infer<typeof teamMemberSchema>
export type Decision = z.infer<typeof decisionSchema>
export type Analysis = z.infer<typeof analysisSchema>
export type Snapshot = z.infer<typeof snapshotSchema>
