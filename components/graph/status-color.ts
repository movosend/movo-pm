import type { Node } from "@/lib/schema/snapshot"

/**
 * Decorative only — never used for calculations. Metrics always read
 * `type` (statusType), per the domain invariant that names are renamable
 * per team. The one exception here is "In Review", which needs the name
 * to get a distinct color since Linear reports it under the same `type`
 * ("started") as "In Progress" — this is display-only, it changes nothing
 * about how blocking/completion is computed.
 */
export function statusColorVar(node: Pick<Node, "status" | "type">): string {
  if (node.status === "In Review") return "var(--status-review)"

  switch (node.type) {
    case "completed":
      return "var(--status-done)"
    case "started":
      return "var(--status-flow)"
    case "unstarted":
      return "var(--status-wait)"
    case "backlog":
    case "canceled":
    default:
      return "var(--status-sleep)"
  }
}

export function statusTextVar(node: Pick<Node, "status" | "type">): string {
  const color = statusColorVar(node)
  return color === "var(--status-done)" || color === "var(--status-sleep)"
    ? "var(--muted-foreground)"
    : color
}
