// apps/web/src/lib/ai/providers.ts
import "server-only"

import { generateText, Output } from "ai"
import type { ZodType } from "zod"

import { serverEnv, type AiMode } from "@/lib/env/server"
import { logAiCall, tokensFromUsage } from "@/lib/ai/log"

/**
 * The LLM must never decide whether an alert fires. This module only generates
 * text (briefs, translations, E-FIR wording, NL→SQL). Scoring and dispatch
 * live elsewhere and do not call these providers.
 */

export type LlmProviderId = "groq" | "gemini" | "rules-only"

export type GenerateAiResult<T = string> = {
  text: string
  output: T | null
  model: string
  provider: LlmProviderId
  fallbackUsed: boolean
  latencyMs: number
  inputTokens: number | null
  outputTokens: number | null
  totalTokens: number | null
}

export type GenerateAiOptions<T> = {
  purpose: string
  prompt: string
  timeoutMs?: number
  maxOutputTokens?: number
  schema?: ZodType<T>
}

function llmDisabled(mode: AiMode): boolean {
  return mode === "onnx-local" || mode === "rules-only"
}

function providerOrder(mode: AiMode): Array<"groq" | "gemini"> {
  if (mode === "gemini") return ["gemini", "groq"]
  return ["groq", "gemini"]
}

function modelFor(id: "groq" | "gemini"): { model: string; label: string } {
  if (id === "gemini") {
    if (!serverEnv.googleApiKey) {
      throw new Error("GOOGLE_GENERATIVE_AI_API_KEY missing")
    }
    return {
      model: `google/${serverEnv.geminiModel}`,
      label: serverEnv.geminiModel,
    }
  }
  if (!serverEnv.groqApiKey) {
    throw new Error("GROQ_API_KEY missing")
  }
  return { model: `groq/${serverEnv.groqModel}`, label: serverEnv.groqModel }
}

async function httpComplete(
  id: "groq" | "gemini",
  prompt: string,
  timeoutMs: number,
  maxOutputTokens: number,
): Promise<{ text: string; usage: unknown }> {
  const abort = AbortSignal.timeout(timeoutMs)
  if (id === "groq") {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      signal: abort,
      headers: {
        authorization: `Bearer ${serverEnv.groqApiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: serverEnv.groqModel,
        max_tokens: maxOutputTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    })
    if (!res.ok) {
      throw new Error(`groq_http_${res.status}`)
    }
    const json: unknown = await res.json()
    const rec = json && typeof json === "object" ? (json as Record<string, unknown>) : {}
    const choices = Array.isArray(rec.choices) ? rec.choices : []
    const first = choices[0] && typeof choices[0] === "object" ? (choices[0] as Record<string, unknown>) : {}
    const message =
      first.message && typeof first.message === "object"
        ? (first.message as Record<string, unknown>)
        : {}
    const text = typeof message.content === "string" ? message.content : ""
    return { text, usage: rec.usage }
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${serverEnv.geminiModel}:generateContent?key=${encodeURIComponent(serverEnv.googleApiKey)}`
  const res = await fetch(url, {
    method: "POST",
    signal: abort,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens },
    }),
  })
  if (!res.ok) {
    throw new Error(`gemini_http_${res.status}`)
  }
  const json: unknown = await res.json()
  const rec = json && typeof json === "object" ? (json as Record<string, unknown>) : {}
  const candidates = Array.isArray(rec.candidates) ? rec.candidates : []
  const first =
    candidates[0] && typeof candidates[0] === "object"
      ? (candidates[0] as Record<string, unknown>)
      : {}
  const content =
    first.content && typeof first.content === "object"
      ? (first.content as Record<string, unknown>)
      : {}
  const parts = Array.isArray(content.parts) ? content.parts : []
  const texts = parts
    .map((part) =>
      part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string"
        ? (part as { text: string }).text
        : "",
    )
    .filter((t) => t.length > 0)
  return { text: texts.join("\n"), usage: rec.usageMetadata }
}

async function callProvider<T>(
  id: "groq" | "gemini",
  options: GenerateAiOptions<T>,
  timeoutMs: number,
): Promise<GenerateAiResult<T>> {
  const started = Date.now()
  const { model, label } = modelFor(id)
  const maxOutputTokens = options.maxOutputTokens ?? serverEnv.llmMaxTokens
  const abort = AbortSignal.timeout(timeoutMs)
  const base = {
    model,
    prompt: options.prompt,
    maxOutputTokens,
    maxRetries: 1,
    abortSignal: abort,
    timeout: { totalMs: timeoutMs },
  }

  try {
    const result = options.schema
      ? await generateText({
          ...base,
          output: Output.object({ schema: options.schema }),
        })
      : await generateText(base)

    const usage = tokensFromUsage(result.usage)
    const output =
      options.schema && "output" in result
        ? ((result as { output: T }).output ?? null)
        : null
    const text =
      typeof result.text === "string" && result.text.trim().length > 0
        ? result.text.trim()
        : output
          ? JSON.stringify(output)
          : ""
    if (text.length === 0) throw new Error("empty_llm_text")

    return {
      text,
      output,
      model: label,
      provider: id,
      fallbackUsed: false,
      latencyMs: Date.now() - started,
      inputTokens: usage.input,
      outputTokens: usage.output,
      totalTokens: usage.total,
    }
  } catch {
    const http = await httpComplete(id, options.prompt, timeoutMs, maxOutputTokens)
    const usage = tokensFromUsage(http.usage)
    let output: T | null = null
    if (options.schema) {
      try {
        output = options.schema.parse(JSON.parse(http.text))
      } catch {
        output = null
      }
    }
    const text = http.text.trim()
    if (text.length === 0) throw new Error("empty_llm_text")
    return {
      text,
      output,
      model: label,
      provider: id,
      fallbackUsed: true,
      latencyMs: Date.now() - started,
      inputTokens: usage.input,
      outputTokens: usage.output,
      totalTokens: usage.total,
    }
  }
}

export async function generateWithFallback<T = string>(
  options: GenerateAiOptions<T>,
): Promise<GenerateAiResult<T>> {
  const timeoutMs = options.timeoutMs ?? serverEnv.llmTimeoutMs
  const mode = serverEnv.aiMode
  const started = Date.now()

  if (llmDisabled(mode)) {
    const empty: GenerateAiResult<T> = {
      text: "",
      output: null,
      model: mode,
      provider: "rules-only",
      fallbackUsed: true,
      latencyMs: Date.now() - started,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
    }
    logAiCall({
      purpose: options.purpose,
      model: mode,
      latency_ms: empty.latencyMs,
      input_tokens: null,
      output_tokens: null,
      total_tokens: null,
      fallback_used: true,
      ok: true,
    })
    return empty
  }

  const order = providerOrder(mode)
  let lastError: unknown
  for (let i = 0; i < order.length; i += 1) {
    const id = order[i]
    if (!id) continue
    try {
      const result = await callProvider(id, options, timeoutMs)
      result.fallbackUsed = i > 0
      logAiCall({
        purpose: options.purpose,
        model: result.model,
        latency_ms: result.latencyMs,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        total_tokens: result.totalTokens,
        fallback_used: result.fallbackUsed,
        ok: true,
      })
      return result
    } catch (cause) {
      lastError = cause
      logAiCall({
        purpose: options.purpose,
        model: id === "groq" ? serverEnv.groqModel : serverEnv.geminiModel,
        latency_ms: Date.now() - started,
        input_tokens: null,
        output_tokens: null,
        total_tokens: null,
        fallback_used: i > 0,
        ok: false,
        error: cause instanceof Error ? cause.message : "llm_failed",
      })
    }
  }

  throw lastError instanceof Error ? lastError : new Error("llm_unavailable")
}
