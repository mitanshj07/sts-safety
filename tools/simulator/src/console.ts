// tools/simulator/src/console.ts
import { formatHms } from "./clock.ts"
import type { AgentSnapshot, ScenarioName } from "./types.ts"

const enabled = process.stdout.isTTY && !process.env.NO_COLOR

function wrap(code: number, s: string): string {
  return enabled ? `\x1b[${code}m${s}\x1b[0m` : s
}

export const ansi = {
  bold: (s: string) => wrap(1, s),
  dim: (s: string) => wrap(2, s),
  red: (s: string) => wrap(31, s),
  green: (s: string) => wrap(32, s),
  yellow: (s: string) => wrap(33, s),
  blue: (s: string) => wrap(34, s),
  magenta: (s: string) => wrap(35, s),
  cyan: (s: string) => wrap(36, s),
  bgRed: (s: string) => (enabled ? `\x1b[41;97;1m${s}\x1b[0m` : s),
}

function zoneColor(category: string, name: string): string {
  if (category === "restricted" || category === "high_risk" || category === "border") {
    return ansi.red(name)
  }
  if (category === "caution" || category === "forest_reserve") return ansi.yellow(name)
  if (category === "safe" || category === "accommodation") return ansi.green(name)
  return ansi.dim(name)
}

function scoreColor(score: number): string {
  const s = score.toString().padStart(3, " ")
  if (score >= 85) return ansi.green(s)
  if (score >= 60) return ansi.yellow(s)
  return ansi.red(s)
}

function pad(s: string, n: number): string {
  const plain = s.replace(/\x1b\[[0-9;]*m/g, "")
  if (plain.length >= n) return s.slice(0, n)
  return s + " ".repeat(n - plain.length)
}

export function renderFrame(input: {
  scenario: ScenarioName
  seed: number
  speed: number
  simMs: number
  wallMs: number
  snapshots: AgentSnapshot[]
  countdownSec: number | null
  countdownLabel: string | null
  pingCount: number
  emitErrors: number
  offline: boolean
}): string {
  const lines: string[] = []
  const header = ` STS SIM  ${input.scenario}  seed=${input.seed}  speed=${input.speed}x  sim=${formatHms(input.simMs)}  wall=${formatHms(input.wallMs)}  pings=${input.pingCount}${input.offline ? "  OFFLINE" : ""}`
  lines.push(ansi.bold(ansi.cyan(`┌${"─".repeat(118)}┐`)))
  lines.push(ansi.cyan("│") + pad(header, 118) + ansi.cyan("│"))

  if (input.countdownSec !== null && input.countdownLabel) {
    const t = formatHms(input.countdownSec * 1000)
    const msg =
      input.countdownSec <= 0
        ? ansi.bgRed(`  BREACH  ${input.countdownLabel}  `)
        : input.countdownSec < 15
          ? ansi.red(` ⚠  ZONE BREACH in ${t}  →  ${input.countdownLabel}`)
          : ansi.yellow(` ⚠  ZONE BREACH in ${t}  →  ${input.countdownLabel}`)
    lines.push(ansi.cyan("│") + pad(` ${msg}`, 118) + ansi.cyan("│"))
  }

  lines.push(ansi.cyan("│") + pad("", 118) + ansi.cyan("│"))
  lines.push(
    ansi.cyan("│") +
      pad(
        ansi.dim(" #  Name                 Lat        Lon        Zone                         Spd   Batt  Score  Flags"),
        118,
      ) +
      ansi.cyan("│"),
  )

  const rows = [...input.snapshots].sort((a, b) => Number(b.featured) - Number(a.featured) || a.slot - b.slot)
  for (const row of rows) {
    const flags = [
      row.featured ? ansi.magenta("★") : " ",
      row.silent ? ansi.red("SIL") : "   ",
      row.sosFired ? ansi.red("SOS") : "   ",
      row.insideIncidentZone ? ansi.red("IN") : "  ",
    ].join(" ")
    const body = [
      String(row.slot + 1).padStart(2, " "),
      pad(row.featured ? ansi.bold(row.label) : row.label, 20),
      row.lat.toFixed(5).padStart(9, " "),
      row.lon.toFixed(5).padStart(10, " "),
      pad(zoneColor(row.zoneCategory, row.zoneName), 28),
      `${row.speedMps.toFixed(1).padStart(4, " ")}`,
      `${String(row.batteryPct).padStart(3, " ")}%`,
      scoreColor(row.score),
      flags,
    ].join("  ")
    lines.push(ansi.cyan("│") + pad(` ${body}`, 118) + ansi.cyan("│"))
  }

  if (input.emitErrors > 0) {
    lines.push(ansi.cyan("│") + pad(ansi.red(` emit errors: ${input.emitErrors}`), 118) + ansi.cyan("│"))
  }
  lines.push(ansi.cyan(`└${"─".repeat(118)}┘`))
  return lines.join("\n")
}

export function redraw(frame: string): void {
  if (process.stdout.isTTY) {
    process.stdout.write("\x1b[?25l\x1b[H\x1b[2J")
  }
  process.stdout.write(frame + "\n")
}

export function showCursor(): void {
  if (process.stdout.isTTY) process.stdout.write("\x1b[?25h")
}
