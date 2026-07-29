// Validated against the real Linear API (movo-pm-preplan.md, Anexo).
// 250 issues / 50 relations per issue is enough headroom for this team;
// paginate only if the cycle ever approaches those limits.
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
        issues(first: 250) {
          nodes {
            ...Core
            children(first: 50) {
              nodes {
                ...Lite
              }
            }
            relations(first: 50) {
              nodes {
                type
                relatedIssue {
                  ...Lite
                }
              }
            }
            inverseRelations(first: 50) {
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
