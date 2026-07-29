import "server-only"

import { readFileSync } from "node:fs"
import path from "node:path"

import Anthropic from "@anthropic-ai/sdk"
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod"

import { buildAnalysisInput } from "@/lib/analysis/build-input"
import { validateAnalysisIds } from "@/lib/analysis/validate-ids"
import { analysisSchema } from "@/lib/schema/snapshot"
import type { Analysis, Snapshot } from "@/lib/schema/snapshot"

const PLAYBOOK_PATH = path.join(process.cwd(), "docs", "analysis-playbook.md")
const MODEL = "claude-sonnet-5"

let client: Anthropic | null = null
function getClient(): Anthropic {
  if (!client) client = new Anthropic()
  return client
}

export type GenerateResult = {
  analysis: Analysis | null
  model: string
  inputTokens: number
  outputTokens: number
}

/**
 * The calculation/writing wall (preplan §2.6): everything under `input` is
 * already-computed metrics and summaries — the model only writes prose
 * around numbers it never touches. Validated with Zod via structured
 * outputs; if that ever fails to parse, retry once, then degrade to
 * metrics-only (null analysis) rather than surface a broken response.
 */
export async function generateAnalysis(
  snapshot: Snapshot,
  previous: Snapshot | null
): Promise<GenerateResult> {
  const playbook = readFileSync(PLAYBOOK_PATH, "utf-8")
  const input = buildAnalysisInput(snapshot, previous)

  let inputTokens = 0
  let outputTokens = 0

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const message = await getClient().messages.parse({
        model: MODEL,
        max_tokens: 8192,
        system: playbook,
        output_config: {
          format: zodOutputFormat(analysisSchema),
          effort: "medium",
        },
        messages: [{ role: "user", content: JSON.stringify(input) }],
      })

      inputTokens += message.usage.input_tokens
      outputTokens += message.usage.output_tokens

      if (message.parsed_output) {
        const analysis: Analysis = {
          ...message.parsed_output,
          generated: new Date().toISOString(),
        }
        return {
          analysis: validateAnalysisIds(analysis, snapshot),
          model: MODEL,
          inputTokens,
          outputTokens,
        }
      }
    } catch (error) {
      // Parsing/validation failure — retry once, then degrade below.
      console.warn(`[analysis] attempt ${attempt + 1} failed:`, error)
    }
  }

  return { analysis: null, model: MODEL, inputTokens, outputTokens }
}
