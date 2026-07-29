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
  estimate
  url
  state {
    name
    type
  }
  assignee {
    displayName
  }
  parent {
    identifier
  }
}
fragment Lite on Issue {
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
  parent {
    identifier
  }
  cycle {
    id
  }
}`
