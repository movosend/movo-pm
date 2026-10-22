export type TeamIssue = {
  id: string
  identifier: string
  title: string
  url: string
  updatedAt: string
  archivedAt: string | null
  state: { name: string; type: string } | null
  assignee: { displayName: string } | null
  cycle: { name: string | null; number: number } | null
}

export type TeamIssuePage = {
  issues: TeamIssue[]
  nextCursor: string | null
}
