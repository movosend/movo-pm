export function FreshnessIndicator({
  taken,
  live,
}: {
  taken: string
  live: boolean
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {live && (
        <span
          className="size-1.5 rounded-full"
          style={{ background: "var(--status-flow)" }}
        />
      )}
      {live ? "en vivo" : "datos al"} {taken}
    </span>
  )
}
