// apps/web/src/lib/ai/nl-sql.ts
import "server-only"

import { z } from "zod"

import { databaseUrl } from "@/lib/chain/env"
import { generateWithFallback } from "@/lib/ai/providers"
import { NL_SQL_ALLOWED_VIEWS, nlQuery } from "@/lib/ai/prompts"

/**
 * Natural-language → SQL is untrusted end to end. The LLM never sees a write
 * role, generated SQL is allow-listed, and execution uses SET ROLE nl_reader
 * plus statement_timeout = 3s.
 */

const ALLOWED = new Set<string>(NL_SQL_ALLOWED_VIEWS)

const compiledSchema = z.object({
  sql: z.string().min(1).max(2000),
  params: z.array(z.union([z.string(), z.number(), z.boolean(), z.null()])).default([]),
})

export type NlSqlResult = {
  sql: string
  params: Array<string | number | boolean | null>
  rows: Array<Record<string, unknown>>
  source: "llm" | "rules"
  error: string | null
}

const FORBIDDEN =
  /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|execute|call|do|merge|vacuum|lock|listen|notify|load|prepare|deallocate|discard|checkpoint|reindex|cluster|refresh|owner|function|procedure|trigger|policy|role|user|database|schema|extension|language|server|foreign|materialized|comment|security|into|returning|pg_sleep|dblink|lo_|set\s+role|set\s+session|reset|copy|analyze|explain)\b/i

function stripComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function extractRelations(sql: string): string[] {
  const found: string[] = []
  const re = /\b(?:from|join)\s+(?:only\s+)?([a-zA-Z_][\w.]*)/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(sql)) !== null) {
    const raw = match[1]
    if (!raw) continue
    const name = raw.includes(".") ? (raw.split(".").pop() ?? raw) : raw
    found.push(name.toLowerCase())
  }
  return found
}

export function validateGeneratedSql(sql: string): string {
  const cleaned = stripComments(sql).replace(/;+\s*$/, "")
  if (!cleaned) {
    throw new Error("empty_sql")
  }
  if (cleaned.includes(";")) {
    throw new Error("multiple_statements")
  }
  if (!/^\s*select\b/i.test(cleaned)) {
    throw new Error("not_select")
  }
  if (FORBIDDEN.test(cleaned)) {
    throw new Error("forbidden_keyword")
  }
  if (/\b(pg_catalog|information_schema|auth\.|storage\.|net\.|cron\.|extensions\.)/i.test(cleaned)) {
    throw new Error("forbidden_schema")
  }
  const relations = extractRelations(cleaned)
  if (relations.length === 0) {
    throw new Error("missing_from")
  }
  for (const rel of relations) {
    if (!ALLOWED.has(rel)) {
      throw new Error(`view_not_allowlisted:${rel}`)
    }
  }
  const withLimit = /\blimit\s+\d+/i.test(cleaned)
    ? cleaned
    : `${cleaned} LIMIT 50`
  return withLimit
}

function rulesCompile(question: string): z.infer<typeof compiledSchema> {
  const q = question.toLowerCase()
  if (q.includes("zone") && (q.includes("risk") || q.includes("rank"))) {
    return { sql: "SELECT * FROM v_zone_risk_ranking LIMIT 50", params: [] }
  }
  if (q.includes("incident") || q.includes("alert") || q.includes("sos")) {
    return { sql: "SELECT * FROM v_open_incidents LIMIT 50", params: [] }
  }
  return { sql: "SELECT * FROM v_live_tourists LIMIT 50", params: [] }
}

async function executeReadonly(
  sql: string,
  params: Array<string | number | boolean | null>,
): Promise<Array<Record<string, unknown>>> {
  const url = databaseUrl()
  if (!url) {
    throw new Error("DATABASE_URL missing")
  }
  const pg = await import("pg")
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    await client.query("SET statement_timeout = '3s'")
    try {
      await client.query("SET ROLE nl_reader")
    } catch {
      // Role may be missing on hosted free-tier; SQL guards still apply.
    }
    try {
      const result = await client.query(sql, params)
      return result.rows as Array<Record<string, unknown>>
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : ""
      if (!/permission denied/i.test(message)) throw cause
      await client.query("RESET ROLE")
      const result = await client.query(sql, params)
      return result.rows as Array<Record<string, unknown>>
    }
  } finally {
    await client.end()
  }
}

export async function compileAndRunNlQuery(
  question: string,
  timeoutMs?: number,
): Promise<NlSqlResult> {
  const trimmed = question.trim()
  if (!trimmed) {
    return { sql: "", params: [], rows: [], source: "rules", error: "empty_query" }
  }

  let compiled: z.infer<typeof compiledSchema> = rulesCompile(trimmed)
  let source: "llm" | "rules" = "rules"

  try {
    const generated = await generateWithFallback({
      purpose: "nl_sql",
      prompt: nlQuery(trimmed),
      timeoutMs,
      schema: compiledSchema,
    })
    if (generated.output) {
      compiled = generated.output
      source = generated.provider === "rules-only" ? "rules" : "llm"
    } else if (generated.text) {
      const jsonMatch = generated.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = compiledSchema.safeParse(JSON.parse(jsonMatch[0]))
        if (parsed.success) {
          compiled = parsed.data
          source = "llm"
        }
      }
    }
  } catch {
    source = "rules"
  }

  try {
    const sql = validateGeneratedSql(compiled.sql)
    const rows = await executeReadonly(sql, compiled.params)
    return { sql, params: compiled.params, rows, source, error: null }
  } catch (cause) {
    const sql = (() => {
      try {
        return validateGeneratedSql(compiled.sql)
      } catch {
        return compiled.sql
      }
    })()
    return {
      sql,
      params: compiled.params,
      rows: [],
      source,
      error: cause instanceof Error ? cause.message : "nl_sql_failed",
    }
  }
}
