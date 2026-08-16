// tools/simulator/src/env.ts
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, parse as parsePath } from "node:path"
import { fileURLToPath } from "node:url"
import { z } from "zod"

const emptyToUndef = (value: unknown): unknown =>
  value === "" || value === undefined ? undefined : value

const envSchema = z.object({
  DB_MODE: z.preprocess(emptyToUndef, z.enum(["supabase-cloud", "supabase-local"]).default("supabase-cloud")),
  NEXT_PUBLIC_SUPABASE_URL: z.string().default(""),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().default(""),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(""),
  LOCAL_SUPABASE_URL: z.string().default("http://127.0.0.1:54321"),
  LOCAL_SUPABASE_ANON_KEY: z.string().default(""),
  SIM_SUPABASE_SERVICE_KEY: z.string().default(""),
  SIM_TOURIST_COUNT: z.coerce.number().int().positive().default(25),
  SIM_TICK_MS: z.coerce.number().int().positive().default(1000),
  SIM_SPEED_MULTIPLIER: z.coerce.number().positive().default(5),
  SIM_SCENARIO: z.preprocess(
    emptyToUndef,
    z
      .enum([
        "normal-trek",
        "zone-breach",
        "signal-loss",
        "route-deviation",
        "panic-sos",
        "stationary-anomaly",
      ])
      .default("normal-trek"),
  ),
  PING_INTERVAL_MOVING_MS: z.coerce.number().int().positive().default(5000),
  PING_INTERVAL_STATIONARY_MS: z.coerce.number().int().positive().default(30000),
  PING_INTERVAL_SOS_MS: z.coerce.number().int().positive().default(2000),
  SIGNAL_LOST_MINUTES: z.coerce.number().positive().default(20),
  INACTIVITY_MINUTES: z.coerce.number().positive().default(45),
  DEFAULT_ITINERARY_CORRIDOR_M: z.coerce.number().int().positive().default(2000),
  LOG_LEVEL: z.string().default("info"),
})

export type SimEnv = z.infer<typeof envSchema>

function repoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url))
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  let cwd = process.cwd()
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(cwd, "pnpm-workspace.yaml"))) return cwd
    const parent = parsePath(cwd).dir
    if (parent === cwd) break
    cwd = parent
  }
  return process.cwd()
}

function parseDotEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (value.startsWith('"')) {
      const end = value.indexOf('"', 1)
      value = end >= 1 ? value.slice(1, end) : value.slice(1)
    } else if (value.startsWith("'")) {
      const end = value.indexOf("'", 1)
      value = end >= 1 ? value.slice(1, end) : value.slice(1)
    } else {
      const hash = value.indexOf("#")
      if (hash >= 0) value = value.slice(0, hash).trim()
    }
    out[key] = value
  }
  return out
}

function loadFiles(root: string): Record<string, string> {
  const merged: Record<string, string> = {}
  for (const name of [".env.example", ".env", ".env.local"]) {
    const path = join(root, name)
    if (!existsSync(path)) continue
    Object.assign(merged, parseDotEnv(readFileSync(path, "utf8")))
  }
  return merged
}

export function loadSimEnv(): SimEnv {
  const fileEnv = loadFiles(repoRoot())
  const merged: Record<string, string | undefined> = { ...fileEnv, ...process.env }
  return envSchema.parse(merged)
}

export function supabaseTargets(env: SimEnv): {
  url: string
  anonKey: string
  serviceKey: string
} {
  const local = env.DB_MODE === "supabase-local"
  const url = local ? env.LOCAL_SUPABASE_URL : env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = local ? env.LOCAL_SUPABASE_ANON_KEY : env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = env.SIM_SUPABASE_SERVICE_KEY || env.SUPABASE_SERVICE_ROLE_KEY
  return { url, anonKey, serviceKey }
}

export function findRepoRoot(): string {
  return repoRoot()
}
