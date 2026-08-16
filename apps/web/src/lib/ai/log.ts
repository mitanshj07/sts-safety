// apps/web/src/lib/ai/log.ts
import "server-only"

import { serverEnv } from "@/lib/env/server"

export type AiCallLog = {
  purpose: string
  model: string
  latency_ms: number
  input_tokens: number | null
  output_tokens: number | null
  total_tokens: number | null
  fallback_used: boolean
  ok: boolean
  error?: string
}

export function logAiCall(entry: AiCallLog): void {
  const line = {
    src: "ai",
    event: "llm_call",
    level: serverEnv.logLevel,
    ...entry,
  }
  if (entry.ok) {
    console.info(JSON.stringify(line))
  } else {
    console.warn(JSON.stringify(line))
  }
}

export function tokensFromUsage(usage: unknown): {
  input: number | null
  output: number | null
  total: number | null
} {
  if (!usage || typeof usage !== "object") {
    return { input: null, output: null, total: null }
  }
  const rec = usage as Record<string, unknown>
  const input =
    typeof rec.inputTokens === "number"
      ? rec.inputTokens
      : typeof rec.promptTokens === "number"
        ? rec.promptTokens
        : null
  const output =
    typeof rec.outputTokens === "number"
      ? rec.outputTokens
      : typeof rec.completionTokens === "number"
        ? rec.completionTokens
        : null
  const total =
    typeof rec.totalTokens === "number"
      ? rec.totalTokens
      : input !== null && output !== null
        ? input + output
        : null
  return { input, output, total }
}
