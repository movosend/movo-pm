import type { Node } from "@/lib/schema/snapshot"

export type PlanningCycle = {
  id: string
  name: string
  number: number
  startsAt: string
  endsAt: string
  kind: "current" | "next"
}
export type Stage = {
  id: string
  name: string
  version: number
  archived: boolean
  createdBy: string
  updatedAt: string
}
export type StageItem = {
  issueId: string
  identifier: string
  included: boolean
  token: string
}
export type MembershipChange = {
  issueId: string
  identifier: string
  before: boolean
  token: string
}
export type TransferRow = {
  issueId: string
  identifier: string
  title: string
  beforeCycleId: string | null
  beforeCycleName: string | null
  points: number | null
  eligible: boolean
  reason: string | null
  blockers: string[]
  selected: boolean
}
export type TransferItem = {
  issueId: string
  identifier: string
  beforeCycleId: string | null
  status: string
  error: string | null
}
export type Transfer = {
  id: string
  stageId: string
  cycleId: string
  cycleName: string
  items: TransferItem[]
}
export const isWork = (node: Node) => node.isEpic !== true
export const isPending = (node: Node) =>
  node.type !== "completed" && node.type !== "canceled"
