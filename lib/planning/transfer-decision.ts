/** Decide against current Linear data, including a response lost after a write. */
export function transferDecision({
  current,
  before,
  destination,
  undo,
  attempted,
}: {
  current: string | null
  before: string | null
  destination: string
  undo: boolean
  attempted: boolean
}): "write" | "done" | "skipped" | "undone" | "conflict" {
  const target = undo ? before : destination
  const expected = undo ? destination : before
  if (current === target)
    return undo ? "undone" : attempted ? "done" : "skipped"
  if (current !== expected) return "conflict"
  return "write"
}
