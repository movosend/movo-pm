// Adapted from the query in movo-pm-preplan.md (Anexo): the preplan's
// first:250/50/50/50 nesting exceeds Linear's query complexity budget in
// practice ("Query too complex"). 100/20/20/20 is still well above what a
// 5-person team's cycle needs and stays under the limit — raise it and
// paginate only if the team ever gets close to these numbers.
export const CYCLE_GRAPH_QUERY = `query CycleGraph($teamKey: String!) {
  teams(filter: { key: { eq: $teamKey } }, first: 1) {
    nodes {
      key
      name
      states(first: 50) {
        nodes {
          id
          name
          type
          position
        }
      }
      members(first: 50) {
        nodes {
          id
          displayName
        }
      }
      activeCycle {
        id
        name
        number
        startsAt
        endsAt
        issues(first: 50) {
          nodes {
            ...Core
            children(first: 10) {
              nodes {
                ...Lite
              }
            }
            relations(first: 10) {
              nodes {
                type
                relatedIssue {
                  ...Lite
                }
              }
            }
            inverseRelations(first: 10) {
              nodes {
                type
                issue {
                  ...Lite
                }
              }
            }
          }
        }
      }
    }
  }
}

fragment Core on Issue {
  identifier
  title
  description
  estimate
  url
  state {
    id
    name
    type
  }
  assignee {
    id
    displayName
  }
  parent {
    identifier
  }
}
fragment Lite on Issue {
  description
  identifier
  title
  estimate
  url
  state {
    id
    name
    type
  }
  assignee {
    id
    displayName
  }
  parent {
    identifier
  }
  cycle {
    id
  }
}`

export const ISSUE_UPDATE_MUTATION = `mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) {
  issueUpdate(id: $id, input: $input) {
    success
  }
}`

export const TEAM_ID_QUERY = `query TeamId($teamKey: String!) {
  teams(filter: { key: { eq: $teamKey } }, first: 1) {
    nodes {
      id
    }
  }
}`

/**
 * `issueSearch` is deprecated by Linear in favor of `searchIssues`, which
 * (unlike a plain title `containsIgnoreCase` filter) also matches on the
 * issue identifier — that's what lets "MOVO-123" find that exact issue.
 */
export const ISSUE_SEARCH_QUERY = `query IssueIdentifierSearch($term: String!, $teamId: String!) {
  searchIssues(term: $term, teamId: $teamId, first: 20) {
    nodes {
      identifier
      title
      estimate
      url
      state {
        name
        type
      }
      assignee {
        displayName
      }
      cycle {
        id
      }
    }
  }
}`
