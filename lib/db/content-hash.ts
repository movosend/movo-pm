import { createHash } from "node:crypto"

/** Deterministic hash of a JSON-serializable value (stable key order). */
export function contentHash(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex")
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`
  }
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort()
    const entries = keys.map(
      (k) =>
        `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`
    )
    return `{${entries.join(",")}}`
  }
  return JSON.stringify(value)
}
