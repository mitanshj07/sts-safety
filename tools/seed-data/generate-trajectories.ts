// tools/seed-data/generate-trajectories.ts
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { FEATURE_NAMES } from "../../packages/shared/src/constants/feature-vector.ts"
import { defaultDurationMs } from "../simulator/src/cli.ts"
import { SIGNAL_LOSS_MS, STATIONARY_MS } from "../simulator/src/constants.ts"
import { runOffline, type EngineOptions } from "../simulator/src/engine.ts"
import { extractWindow, vectorRow } from "../simulator/src/features.ts"
import { createRng } from "../simulator/src/rng.ts"
import { buildPlan } from "../simulator/src/scenarios/index.ts"
import type { PingSample, ScenarioName, TouristPlan } from "../simulator/src/types.ts"

const WINDOW = 24
const STRIDE = 8
const TARGET_NORMAL = 5000
const TARGET_ANOMALOUS = 500
const OPTIONS: EngineOptions = {
  pingMovingMs: 5000,
  pingStationaryMs: 5000,
  pingSosMs: 2000,
}

const ANOMALOUS_SCENARIOS: ScenarioName[] = [
  "zone-breach",
  "signal-loss",
  "route-deviation",
  "panic-sos",
  "stationary-anomaly",
]

type Labelled = {
  windowId: string
  scenario: ScenarioName
  label: 0 | 1
  routeId: string
  features: number[]
}

function windowsOf(pings: PingSample[], routeId: TouristPlan["routeId"]): { start: number; pings: PingSample[] }[] {
  const out: { start: number; pings: PingSample[] }[] = []
  for (let i = 0; i + WINDOW <= pings.length; i += STRIDE) {
    out.push({ start: i, pings: pings.slice(i, i + WINDOW) })
  }
  return out
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`
  return s
}

function isAnomalousWindow(scenario: ScenarioName, plan: TouristPlan, slice: PingSample[]): boolean {
  if (slice.length === 0) return false
  const first = slice[0]
  const last = slice[slice.length - 1]
  if (!first || !last) return false
  if (scenario === "zone-breach") {
    return last.lat > 26.55 && last.lon > 93.32 && last.lon < 93.49
  }
  if (scenario === "signal-loss" && plan.silence) {
    const gap = Math.max(
      0,
      ...slice.slice(1).map((p, i) => p.simMs - (slice[i]?.simMs ?? p.simMs)),
    )
    return gap >= SIGNAL_LOSS_MS * 0.4 || (first.simMs < plan.silence.startMs && last.simMs >= plan.silence.startMs)
  }
  if (scenario === "route-deviation" && plan.drift) {
    return last.simMs >= plan.drift.startMs + (plan.drift.endMs - plan.drift.startMs) * 0.5
  }
  if (scenario === "panic-sos" && plan.sosAtMs !== null) {
    return first.simMs <= plan.sosAtMs && last.simMs >= plan.sosAtMs
  }
  if (scenario === "stationary-anomaly" && plan.stationary) {
    return first.simMs >= plan.stationary.startMs && last.simMs <= plan.stationary.startMs + plan.stationary.durationMs
  }
  return false
}

function collect(seed: number): Labelled[] {
  const rows: Labelled[] = []
  let seq = 0

  const push = (scenario: ScenarioName, label: 0 | 1, routeId: TouristPlan["routeId"], slice: PingSample[]) => {
    const features = vectorRow(extractWindow(slice, routeId))
    rows.push({
      windowId: `w${String(seq).padStart(5, "0")}`,
      scenario,
      label,
      routeId,
      features,
    })
    seq += 1
  }

  let normal = 0
  let guard = 0
  while (normal < TARGET_NORMAL && guard < 400) {
    const rng = createRng(seed + 1000 + guard)
    const plan = buildPlan("normal-trek", 4, rng)
    const duration = defaultDurationMs("normal-trek", null)
    const result = runOffline(plan, rng, OPTIONS, duration, 1000)
    for (const tourist of plan.tourists) {
      const pings = result.pings.filter((p) => p.touristSlot === tourist.slot)
      for (const w of windowsOf(pings, tourist.routeId)) {
        if (normal >= TARGET_NORMAL) break
        push("normal-trek", 0, tourist.routeId, w.pings)
        normal += 1
      }
    }
    guard += 1
  }

  const per = Math.floor(TARGET_ANOMALOUS / ANOMALOUS_SCENARIOS.length)
  let anomalous = 0
  for (const scenario of ANOMALOUS_SCENARIOS) {
    let got = 0
    let tries = 0
    while (got < per && tries < 80) {
      const rng = createRng(seed + 5000 + ANOMALOUS_SCENARIOS.indexOf(scenario) * 100 + tries)
      const plan = buildPlan(scenario, 1, rng)
      const featured = plan.tourists[0]
      if (!featured) break
      let duration = defaultDurationMs(scenario, plan.breachAtMs)
      if (scenario === "signal-loss") duration = 4 * 60 * 1000 + SIGNAL_LOSS_MS + 4 * 60 * 1000
      if (scenario === "stationary-anomaly") duration = 2 * 60 * 1000 + STATIONARY_MS
      const result = runOffline(plan, rng, OPTIONS, duration, 1000)
      const pings = result.pings.filter((p) => p.touristSlot === featured.slot)
      if (scenario === "signal-loss" && featured.silence) {
        const before = pings.filter((p) => p.simMs < featured.silence!.startMs)
        const after = pings.filter((p) => p.simMs >= featured.silence!.startMs + featured.silence!.durationMs)
        const bridged = [...before.slice(-12), ...after.slice(0, 12)]
        if (bridged.length >= 16) {
          push(scenario, 1, featured.routeId, bridged.slice(0, WINDOW))
          got += 1
          anomalous += 1
        }
      }
      for (const w of windowsOf(pings, featured.routeId)) {
        if (got >= per) break
        if (!isAnomalousWindow(scenario, featured, w.pings)) continue
        push(scenario, 1, featured.routeId, w.pings)
        got += 1
        anomalous += 1
      }
      tries += 1
    }
  }

  while (anomalous < TARGET_ANOMALOUS) {
    const rng = createRng(seed + 9000 + anomalous)
    const plan = buildPlan("zone-breach", 1, rng)
    const featured = plan.tourists[0]
    if (!featured) break
    const result = runOffline(plan, rng, OPTIONS, defaultDurationMs("zone-breach", plan.breachAtMs), 1000)
    const pings = result.pings.filter((p) => p.touristSlot === featured.slot)
    const w = windowsOf(pings, featured.routeId).at(-1)
    if (w) {
      push("zone-breach", 1, featured.routeId, w.pings)
      anomalous += 1
    } else break
  }

  return rows
}

function main(): void {
  const seed = 2025
  const rows = collect(seed)
  const here = dirname(fileURLToPath(import.meta.url))
  const outDir = join(here, "out")
  mkdirSync(outDir, { recursive: true })

  const header = ["window_id", "scenario", "label", "route_id", ...FEATURE_NAMES].join(",")
  const lines = rows.map((r) =>
    [r.windowId, csvEscape(r.scenario), r.label, csvEscape(r.routeId), ...r.features].join(","),
  )
  const csvPath = join(outDir, "trajectories.csv")
  const jsonPath = join(outDir, "labels.json")
  writeFileSync(csvPath, `${header}\n${lines.join("\n")}\n`, "utf8")
  writeFileSync(
    jsonPath,
    `${JSON.stringify(
      {
        seed,
        feature_order: FEATURE_NAMES,
        n_normal: rows.filter((r) => r.label === 0).length,
        n_anomalous: rows.filter((r) => r.label === 1).length,
        window_pings: WINDOW,
        stride: STRIDE,
        labels: Object.fromEntries(rows.map((r) => [r.windowId, { scenario: r.scenario, label: r.label }])),
      },
      null,
      2,
    )}\n`,
    "utf8",
  )
  const n0 = rows.filter((r) => r.label === 0).length
  const n1 = rows.filter((r) => r.label === 1).length
  console.log(`wrote ${csvPath}`)
  console.log(`wrote ${jsonPath}`)
  console.log(`windows: ${rows.length}  normal=${n0}  anomalous=${n1}`)
}

main()
