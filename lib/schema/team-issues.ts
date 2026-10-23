import type {
  Block,
  Cycle,
  Node,
  TeamMember,
  TeamState,
} from "@/lib/schema/snapshot"

export type TeamGraphPage = {
  nodes: Node[]
  blocks: Block[]
  states: TeamState[]
  members: TeamMember[]
  cycle: Cycle
  nextCursor: string | null
}
