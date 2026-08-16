// tools/simulator/src/cli.ts
import { z } from "zod"
import { scenarioNameSchema, type ScenarioName } from "./types.ts"

function parseSpeed(raw: string): number {
  const n = Number(raw.trim().replace(/x$/i, ""))
  if (!Number.isFinite(n) || n <= 0) throw new Error(`bad --speed ${raw}`)
  return n
}

function parseDuration(raw: string): number {
  const m = /^(\d+(?:\.\d+)?)(ms|s|m|h|min)?$/i.exec(raw.trim())
  if (!m || m[1] === undefined) throw new Error(`bad duration: ${raw}`)
  const n = Number(m[1])
  const unit = (m[2] ?? "s").toLowerCase()
  if (unit === "ms") return n
  if (unit === "s") return n * 1000
  if (unit === "m" || unit === "min") return n * 60_000
  return n * 3_600_000
}

export const cliOptionsSchema = z.object({
  tourists: z.number().int().positive(),
  scenario: scenarioNameSchema,
  speed: z.number().positive(),
  seed: z.number().int(),
  tickMs: z.number().int().positive(),
  durationMs: z.number().positive().nullable(),
  replay: z.string().nullable(),
  record: z.string().nullable(),
  offline: z.boolean(),
})
export type CliOptions = z.infer<typeof cliOptionsSchema>

function readFlag(argv: string[], name: string): string | undefined {
  const idx = argv.indexOf(`--${name}`)
  if (idx === -1) return undefined
  return argv[idx + 1]
}

function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(`--${name}`)
}

export function parseCli(
  argv: string[],
  defaults: {
    tourists: number
    scenario: ScenarioName
    speed: number
    tickMs: number
  },
): CliOptions {
  const touristsRaw = readFlag(argv, "tourists")
  const scenarioRaw = readFlag(argv, "scenario")
  const speedRaw = readFlag(argv, "speed")
  const seedRaw = readFlag(argv, "seed")
  const tickRaw = readFlag(argv, "tick-ms")
  const durationRaw = readFlag(argv, "duration")
  const replay = readFlag(argv, "replay") ?? null
  const record = readFlag(argv, "record") ?? null

  return cliOptionsSchema.parse({
    tourists: touristsRaw ? z.coerce.number().int().positive().parse(touristsRaw) : defaults.tourists,
    scenario: scenarioRaw ? scenarioNameSchema.parse(scenarioRaw) : defaults.scenario,
    speed: speedRaw ? parseSpeed(speedRaw) : defaults.speed,
    seed: seedRaw ? z.coerce.number().int().parse(seedRaw) : 2025,
    tickMs: tickRaw ? z.coerce.number().int().positive().parse(tickRaw) : defaults.tickMs,
    durationMs: durationRaw ? parseDuration(durationRaw) : null,
    replay,
    record,
    offline: hasFlag(argv, "offline"),
  })
}

export function defaultDurationMs(scenario: ScenarioName, breachAtMs: number | null): number {
  if (scenario === "zone-breach") {
    return (breachAtMs ?? 15 * 60 * 1000) + 45_000
  }
  if (scenario === "signal-loss") return 30 * 60 * 1000
  if (scenario === "stationary-anomaly") return 53 * 60 * 1000
  if (scenario === "panic-sos") return 6 * 60 * 1000
  if (scenario === "route-deviation") return 12 * 60 * 1000
  return 10 * 60 * 1000
}
