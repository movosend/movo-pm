const ISSUE_DETAIL_FRAGMENT = `fragment Lite on Issue {
  description
  id
  childCheck: children(first: 1) { nodes { id } }
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
  parent { identifier title }
  cycle { id name number }
}`

// Small pages keep nested epic classification below Linear's complexity limit.
// The client follows every cursor; this is a page size, not a result limit.
export const CYCLE_GRAPH_QUERY = `query CycleGraph($teamKey: String!, $after: String) {
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
        issues(first: 25, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes {
            ...Core
            children(first: 10) {
              pageInfo { hasNextPage endCursor }
              nodes {
                ...Lite
              }
            }
            relations(first: 10) {
              pageInfo { hasNextPage endCursor }
              nodes {
                type
                relatedIssue {
                  ...Lite
                }
              }
            }
            inverseRelations(first: 10) {
              pageInfo { hasNextPage endCursor }
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
  id
  childCheck: children(first: 1) { nodes { id } }
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
  parent { ...Lite }
  cycle { id name number }
}
${ISSUE_DETAIL_FRAGMENT}`

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
      id
  childCheck: children(first: 1) { nodes { id } }
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

export const ISSUE_DETAIL_QUERY = `query IssueDetail($id: String!, $childrenAfter: String, $relationsAfter: String, $inverseAfter: String) {
  issue(id: $id) {
    ...Lite
    team {
      states(first: 50) { nodes { id name type position } }
      members(first: 50) { nodes { id displayName } }
    }
    parent { ...Lite }
    children(first: 50, after: $childrenAfter) { nodes { ...Lite } pageInfo { hasNextPage endCursor } }
    relations(first: 50, after: $relationsAfter) { nodes { type relatedIssue { ...Lite } } pageInfo { hasNextPage endCursor } }
    inverseRelations(first: 50, after: $inverseAfter) { nodes { type issue { ...Lite } } pageInfo { hasNextPage endCursor } }
  }
}
${ISSUE_DETAIL_FRAGMENT}`
