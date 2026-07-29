import type { Node } from "@/lib/schema/snapshot"

// Keyword matching only — this is the one place descriptions get read (per
// preplan §2.6). The model never sees full descriptions, only the short
// snippet extracted here.
const KEYWORD_PATTERN =
  /\b(credencial|credenciales|sandbox|api key|proveedor|tercero|terceros|cuenta de|acceso a|integraci[oó]n con|esperando|pendiente de)\b/i

export type ExternalDependencySignal = {
  id: string
  snippet: string
}

function snippetAround(text: string, index: number, radius = 60): string {
  const start = Math.max(0, index - radius)
  const end = Math.min(text.length, index + radius)
  const prefix = start > 0 ? "…" : ""
  const suffix = end < text.length ? "…" : ""
  return `${prefix}${text.slice(start, end).trim()}${suffix}`
}

export function extractSignals(nodes: Node[]): ExternalDependencySignal[] {
  const signals: ExternalDependencySignal[] = []

  for (const node of nodes) {
    if (!node.description) continue
    const match = KEYWORD_PATTERN.exec(node.description)
    if (!match) continue
    signals.push({
      id: node.id,
      snippet: snippetAround(node.description, match.index),
    })
  }

  return signals
}
