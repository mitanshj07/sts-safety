// tools/simulator/src/index.ts
import { join } from "node:path"
import { adminClient, bindTourists } from "./auth.ts"
import { defaultDurationMs, parseCli } from "./cli.ts"
import { formatHms } from "./clock.ts"
import { ansi, redraw, renderFrame, showCursor } from "./console.ts"
import { createWorld, runOffline, stepWorld, type EngineOptions } from "./engine.ts"
import {
  countIncidentsSince,
  emitPing,
  emitSos,
  touristClient,
} from "./emit.ts"
import { findRepoRoot, loadSimEnv, supabaseTargets } from "./env.ts"
import { createRng } from "./rng.ts"
import { emptyRecording, readRecording, writeRecording } from "./replay.ts"
import { buildPlan } from "./scenarios/index.ts"
import type { BoundTourist, Recording, RecordingEvent } from "./types.ts"

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function engineOptions(env: ReturnType<typeof loadSimEnv>): EngineOptions {
  return {
    pingMovingMs: env.PING_INTERVAL_MOVING_MS,
    pingStationaryMs: env.PING_INTERVAL_STATIONARY_MS,
    pingSosMs: env.PING_INTERVAL_SOS_MS,
  }
}

function liveIso(baseMs: number, simMs: number): string {
  return new Date(baseMs + simMs).toISOString()
}

async function playRecording(
  recording: Recording,
  opts: {
    offline: boolean
    bound: BoundTourist[] | null
    url: string
    anonKey: string
  },
): Promise<void> {
  const wallStart = Date.now()
  let pingCount = 0
  let emitErrors = 0
  const clients = new Map<number, ReturnType<typeof touristClient>>()
  if (opts.bound) {
    for (const b of opts.bound) {
      clients.set(b.slot, touristClient(opts.url, opts.anonKey, b.accessToken))
    }
  }
  const bySlot = new Map(opts.bound?.map((b) => [b.slot, b]) ?? [])
  let lastSim = 0
  for (const event of recording.events) {
    const simMs = event.kind === "ping" ? event.ping.simMs : event.sos.simMs
    const wait = (simMs - lastSim) / recording.speed
    if (wait > 0 && !opts.offline) await sleep(wait)
    lastSim = simMs
    const recordedAt = liveIso(wallStart, simMs)
    if (event.kind === "ping" && !event.ping.silent && opts.bound) {
      const b = bySlot.get(event.ping.touristSlot)
      const client = clients.get(event.ping.touristSlot)
      if (b && client) {
        const result = await emitPing(client, b.touristId, event.ping, recordedAt)
        if (!result.ok) emitErrors += 1
        else pingCount += 1
      }
    } else if (event.kind === "sos" && opts.bound) {
      const b = bySlot.get(event.sos.touristSlot)
      const client = clients.get(event.sos.touristSlot)
      if (b && client) {
        const result = await emitSos(client, b.touristId, event.sos, recordedAt)
        if (!result.ok) emitErrors += 1
      }
    } else if (opts.offline && event.kind === "ping") {
      pingCount += 1
    }
  }
  console.log(
    ansi.green(`replay complete  pings=${pingCount}  errors=${emitErrors}  wall=${formatHms(Date.now() - wallStart)}`),
  )
}

async function main(): Promise<void> {
  const env = loadSimEnv()
  const cli = parseCli(process.argv.slice(2), {
    tourists: env.SIM_TOURIST_COUNT,
    scenario: env.SIM_SCENARIO,
    speed: env.SIM_SPEED_MULTIPLIER,
    tickMs: env.SIM_TICK_MS,
  })
  const rng = createRng(cli.seed)
  const options = engineOptions(env)
  const targets = supabaseTargets(env)
  const canOnline =
    !cli.offline &&
    targets.url.length > 0 &&
    targets.anonKey.length > 8 &&
    targets.serviceKey.length > 8 &&
    !targets.anonKey.includes("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...")

  if (cli.replay) {
    const recording = readRecording(cli.replay)
    let bound: BoundTourist[] | null = null
    if (canOnline) {
      const plan = buildPlan(recording.scenario, recording.tourists.length, createRng(recording.seed))
      bound = await bindTourists(
        targets.url,
        targets.anonKey,
        targets.serviceKey,
        plan,
        env.DEFAULT_ITINERARY_CORRIDOR_M,
      )
    }
    await playRecording(recording, {
      offline: !canOnline,
      bound,
      url: targets.url,
      anonKey: targets.anonKey,
    })
    return
  }

  const plan = buildPlan(cli.scenario, cli.tourists, rng)
  const durationMs = cli.durationMs ?? defaultDurationMs(cli.scenario, plan.breachAtMs)
  const recordPath =
    cli.record ??
    join(findRepoRoot(), "tools/simulator/recordings", `${cli.scenario}-seed${cli.seed}.json`)
  const recording = emptyRecording(plan, cli.seed, cli.speed, cli.tickMs)

  if (cli.offline || !canOnline) {
    if (!cli.offline && !canOnline) {
      console.log(ansi.yellow("Supabase keys missing — running offline fallback (engine only, no RLS inserts)."))
    }
    const result = runOffline(plan, createRng(cli.seed), options, durationMs, cli.tickMs)
    const events: RecordingEvent[] = [
      ...result.pings.map((ping) => ({ kind: "ping" as const, ping })),
      ...result.sos.map((sos) => ({ kind: "sos" as const, sos })),
    ].sort((a, b) => {
      const ta = a.kind === "ping" ? a.ping.simMs : a.sos.simMs
      const tb = b.kind === "ping" ? b.ping.simMs : b.sos.simMs
      return ta - tb
    })
    recording.events = events
    writeRecording(recordPath, recording)

    const featured = result.world.agents.find((a) => a.plan.featured)
    const last = stepWorld(result.world, 0)
    redraw(
      renderFrame({
        scenario: plan.scenario,
        seed: cli.seed,
        speed: cli.speed,
        simMs: result.world.simMs,
        wallMs: 0,
        snapshots: last.snapshots,
        countdownSec: last.countdownSec,
        countdownLabel: last.countdownLabel,
        pingCount: result.pings.length,
        emitErrors: 0,
        offline: true,
      }),
    )
    showCursor()
    const entries = result.world.incidentZoneEntries
    console.log("")
    console.log(
      ansi.bold(
        `VERIFY ${plan.scenario}: restricted-zone entries=${entries}  pings=${result.pings.length}  sos=${result.sos.length}`,
      ),
    )
    if (plan.scenario === "zone-breach") {
      const ok = entries === 1
      console.log(ok ? ansi.green("expected 1 — PASS") : ansi.red(`expected 1 — FAIL`))
      if (featured) {
        console.log(`featured ${featured.plan.label} halted=${featured.halted} inside=${featured.enteredRestricted}`)
      }
    }
    if (plan.scenario === "normal-trek") {
      const ok = entries === 0
      console.log(ok ? ansi.green("expected 0 — PASS") : ansi.red("expected 0 — FAIL"))
    }
    if (plan.breachAtMs !== null) {
      console.log(`narration: breach at sim ${formatHms(plan.breachAtMs)} → ${plan.breachZoneName}`)
    }
    console.log(`recording written ${recordPath}`)
    return
  }

  const bound = await bindTourists(
    targets.url,
    targets.anonKey,
    targets.serviceKey,
    plan,
    env.DEFAULT_ITINERARY_CORRIDOR_M,
  )
  const clients = bound.map((b) => ({
    ...b,
    client: touristClient(targets.url, targets.anonKey, b.accessToken),
  }))
  const bySlot = new Map(clients.map((c) => [c.slot, c]))
  const world = createWorld(plan, createRng(cli.seed), options)
  const liveStart = Date.now()
  const runStartedIso = new Date().toISOString()
  let pingCount = 0
  let emitErrors = 0
  const wallStart = Date.now()

  process.on("SIGINT", () => {
    showCursor()
    writeRecording(recordPath, recording)
    process.exit(130)
  })

  while (world.simMs < durationMs) {
    const stepStart = Date.now()
    const result = stepWorld(world, cli.tickMs)
    const events: RecordingEvent[] = []
    for (const ping of result.pings) {
      events.push({ kind: "ping", ping })
      const b = bySlot.get(ping.touristSlot)
      if (!b) continue
      const recordedAt = liveIso(liveStart, ping.simMs)
      const emitted = await emitPing(b.client, b.touristId, ping, recordedAt)
      if (!emitted.ok) emitErrors += 1
      else pingCount += 1
    }
    for (const sos of result.sos) {
      events.push({ kind: "sos", sos })
      const b = bySlot.get(sos.touristSlot)
      if (!b) continue
      const recordedAt = liveIso(liveStart, sos.simMs)
      const emitted = await emitSos(b.client, b.touristId, sos, recordedAt)
      if (!emitted.ok) emitErrors += 1
    }
    recording.events.push(...events)
    redraw(
      renderFrame({
        scenario: plan.scenario,
        seed: cli.seed,
        speed: cli.speed,
        simMs: world.simMs,
        wallMs: Date.now() - wallStart,
        snapshots: result.snapshots,
        countdownSec: result.countdownSec,
        countdownLabel: result.countdownLabel,
        pingCount,
        emitErrors,
        offline: false,
      }),
    )
    const spent = Date.now() - stepStart
    const wait = Math.max(0, cli.tickMs / cli.speed - spent)
    if (wait > 0) await sleep(wait)
  }

  showCursor()
  writeRecording(recordPath, recording)
  const admin = adminClient(targets.url, targets.serviceKey)
  const counts = await countIncidentsSince(
    admin,
    bound.map((b) => b.touristId),
    runStartedIso,
  )
  console.log("")
  console.log(
    ansi.bold(
      `VERIFY ${plan.scenario}: incidents=${counts.total} ${JSON.stringify(counts.byType)}  pings=${pingCount}`,
    ),
  )
  if (plan.scenario === "zone-breach") {
    const geo = counts.byType["geofence_entry_restricted"] ?? 0
    const ok = counts.total === 1 && geo === 1
    console.log(ok ? ansi.green("expected exactly 1 geofence_entry_restricted — PASS") : ansi.red("expected exactly 1 — FAIL"))
  }
  if (plan.scenario === "normal-trek") {
    const ok = counts.total === 0
    console.log(ok ? ansi.green("expected 0 incidents — PASS") : ansi.red("expected 0 — FAIL"))
  }
  console.log(`recording written ${recordPath}`)
}

main().catch((err: unknown) => {
  showCursor()
  const message = err instanceof Error ? err.message : String(err)
  console.error(ansi.red(message))
  process.exit(1)
})
