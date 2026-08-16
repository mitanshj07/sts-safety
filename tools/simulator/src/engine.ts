// tools/simulator/src/engine.ts
import {
  computeSafetyScore,
  haversine,
  type RiskLevel,
} from "@sts/shared"
import {
  BATTERY_DRAIN_IDLE_PER_HOUR,
  BATTERY_DRAIN_MOVING_PER_HOUR,
  CAR_MPS,
  DROPOUT_MEAN_INTERVAL_MS,
  DROPOUT_MS,
  DWELL_RADIUS_M,
  GPS_SIGMA_M,
  STATIONARY_GPS_SIGMA_M,
  TRAFFIC_MAX,
  TRAFFIC_MIN,
  TREK_MPS,
  WALK_MPS,
} from "./constants.ts"
import {
  offsetMetres,
  perpendicularOffset,
  pointAlong,
  type RouteProfile,
} from "./geo.ts"
import type { Rng } from "./rng.ts"
import { routeById } from "./routes/index.ts"
import type {
  AgentSnapshot,
  PingSample,
  SimPlan,
  SosSample,
  StepResult,
  TouristPlan,
} from "./types.ts"
import { inIncidentZone, primaryZone } from "./zones-local.ts"

export type EngineOptions = {
  pingMovingMs: number
  pingStationaryMs: number
  pingSosMs: number
}

export type Agent = {
  plan: TouristPlan
  rng: Rng
  route: RouteProfile
  progressM: number
  traffic: number
  battery: number
  dwellUntilMs: number | null
  dropoutUntilMs: number | null
  lastPingSimMs: number
  sosFired: boolean
  halted: boolean
  lastTrueLat: number
  lastTrueLon: number
  lastHeading: number
  lastSpeed: number
  enteredRestricted: boolean
}

export type World = {
  plan: SimPlan
  agents: Agent[]
  simMs: number
  originMs: number
  options: EngineOptions
  incidentZoneEntries: number
}

function baseSpeed(mode: TouristPlan["mode"]): number {
  if (mode === "walk") return WALK_MPS
  if (mode === "trek") return TREK_MPS
  return CAR_MPS
}

export function createWorld(plan: SimPlan, rng: Rng, options: EngineOptions): World {
  const originMs = Date.parse(plan.originIso)
  const agents = plan.tourists.map((tourist) => {
    const route = routeById(tourist.routeId).profile
    const start = pointAlong(route, tourist.startProgressM)
    return {
      plan: tourist,
      rng: rng.fork(0x9e3779b9 ^ (tourist.slot + 1) * 0x85ebca6b),
      route,
      progressM: tourist.startProgressM,
      traffic: 1,
      battery: tourist.batteryStart,
      dwellUntilMs: null,
      dropoutUntilMs: null,
      lastPingSimMs: Number.NEGATIVE_INFINITY,
      sosFired: false,
      halted: false,
      lastTrueLat: start.point.lat,
      lastTrueLon: start.point.lon,
      lastHeading: start.heading,
      lastSpeed: 0,
      enteredRestricted: false,
    } satisfies Agent
  })
  return { plan, agents, simMs: 0, originMs, options, incidentZoneEntries: 0 }
}

function pingInterval(agent: Agent, options: EngineOptions): number {
  if (agent.sosFired) return options.pingSosMs
  if (agent.lastSpeed < 0.4) return options.pingStationaryMs
  return options.pingMovingMs
}

function maybeDwell(agent: Agent, simMs: number): void {
  if (agent.dwellUntilMs !== null) {
    if (simMs >= agent.dwellUntilMs) agent.dwellUntilMs = null
    return
  }
  const here = { lat: agent.lastTrueLat, lon: agent.lastTrueLon }
  for (const wp of agent.plan.waypoints) {
    if (wp.dwellMinutes <= 0) continue
    const d = haversine(here, { lat: wp.lat, lon: wp.lon })
    if (d <= DWELL_RADIUS_M && agent.progressM > 30) {
      agent.dwellUntilMs = simMs + wp.dwellMinutes * 60 * 1000
      return
    }
  }
}

function isSilent(agent: Agent, simMs: number): boolean {
  const s = agent.plan.silence
  if (!s) return false
  return simMs >= s.startMs && simMs < s.startMs + s.durationMs
}

function isStationary(agent: Agent, simMs: number): boolean {
  const s = agent.plan.stationary
  if (!s) return false
  return simMs >= s.startMs && simMs < s.startMs + s.durationMs
}

function driftOffsetM(agent: Agent, simMs: number): number {
  const d = agent.plan.drift
  if (!d) return 0
  if (simMs < d.startMs) return 0
  if (simMs >= d.endMs) return d.offsetM
  const t = (simMs - d.startMs) / (d.endMs - d.startMs)
  return d.offsetM * t
}

function stepAgent(world: World, agent: Agent, dtMs: number): { ping: PingSample | null; sos: SosSample | null } {
  const { simMs, originMs, options } = world
  maybeDwell(agent, simMs)

  const stationary = isStationary(agent, simMs)
  const silent = isSilent(agent, simMs)
  const dwelling = agent.dwellUntilMs !== null && simMs < agent.dwellUntilMs

  if (agent.plan.mode === "car") {
    const target = TRAFFIC_MIN + agent.rng.next() * (TRAFFIC_MAX - TRAFFIC_MIN)
    agent.traffic = agent.traffic * 0.92 + target * 0.08
  }

  let speed = baseSpeed(agent.plan.mode) * (agent.plan.mode === "car" ? agent.traffic : 1)
  if (agent.plan.mode === "trek") {
    speed *= agent.lastHeading > 0 && agent.lastHeading < 180 ? 0.92 : 1.05
  }

  const frozen = agent.halted || dwelling || stationary
  if (frozen) speed = 0
  else agent.progressM = Math.min(agent.route.lengthM, agent.progressM + speed * (dtMs / 1000))

  const along = pointAlong(agent.route, agent.progressM)
  const drifted = perpendicularOffset(along.point, along.heading, driftOffsetM(agent, simMs))
  agent.lastTrueLat = drifted.lat
  agent.lastTrueLon = drifted.lon
  agent.lastHeading = along.heading
  agent.lastSpeed = speed

  const drainPerHour = frozen ? BATTERY_DRAIN_IDLE_PER_HOUR : BATTERY_DRAIN_MOVING_PER_HOUR
  agent.battery = Math.max(11, agent.battery - drainPerHour * (dtMs / 3_600_000))

  const incident = inIncidentZone(drifted)
  if (incident && !agent.enteredRestricted) {
    agent.enteredRestricted = true
    world.incidentZoneEntries += 1
    if (agent.plan.haltWhenRestricted) agent.halted = true
  }

  if (
    agent.plan.dropouts &&
    agent.dropoutUntilMs === null &&
    !silent &&
    agent.rng.next() < dtMs / DROPOUT_MEAN_INTERVAL_MS
  ) {
    agent.dropoutUntilMs = simMs + DROPOUT_MS
  }
  if (agent.dropoutUntilMs !== null && simMs >= agent.dropoutUntilMs) {
    agent.dropoutUntilMs = null
  }
  const dropped = agent.dropoutUntilMs !== null && simMs < agent.dropoutUntilMs

  let sos: SosSample | null = null
  if (agent.plan.sosAtMs !== null && !agent.sosFired && simMs >= agent.plan.sosAtMs) {
    agent.sosFired = true
    sos = {
      touristSlot: agent.plan.slot,
      simMs,
      recordedAtIso: new Date(originMs + simMs).toISOString(),
      lat: drifted.lat,
      lon: drifted.lon,
    }
  }

  const interval = pingInterval(agent, options)
  const shouldPing = !silent && !dropped && simMs - agent.lastPingSimMs >= interval
  if (!shouldPing) return { ping: null, sos }

  agent.lastPingSimMs = simMs
  const sigma = stationary ? STATIONARY_GPS_SIGMA_M : GPS_SIGMA_M
  const noisy = offsetMetres(
    drifted,
    agent.rng.gauss(0, sigma),
    agent.rng.gauss(0, sigma),
  )
  const ping: PingSample = {
    touristSlot: agent.plan.slot,
    simMs,
    recordedAtIso: new Date(originMs + simMs).toISOString(),
    lat: noisy.lat,
    lon: noisy.lon,
    accuracyM: Math.max(4, Math.round(Math.abs(agent.rng.gauss(sigma, 2)))),
    speedMps: Number(speed.toFixed(3)),
    headingDeg: Number(along.heading.toFixed(1)),
    batteryPct: Math.round(agent.battery),
    silent: false,
  }
  return { ping, sos }
}

function snapshot(agent: Agent, simMs: number, originMs: number): AgentSnapshot {
  const point = { lat: agent.lastTrueLat, lon: agent.lastTrueLon }
  const zone = primaryZone(point)
  const incident = inIncidentZone(point)
  const risk = (zone?.risk_level ?? "none") as RiskLevel
  const drifted = agent.plan.drift ? driftOffsetM(agent, simMs) - 2000 : null
  const silentFor = agent.plan.silence
    ? isSilent(agent, simMs)
      ? (simMs - agent.plan.silence.startMs) / 60000
      : null
    : null
  const score = computeSafetyScore({
    risk,
    deviationM: drifted,
    silenceMinutes: silentFor,
    openHighIncidents: incident ? 1 : 0,
    anomalyScore: null,
    at: originMs + simMs,
    inAccommodation: zone?.category === "accommodation",
  })
  return {
    slot: agent.plan.slot,
    label: agent.plan.label,
    email: agent.plan.email,
    featured: agent.plan.featured,
    lat: agent.lastTrueLat,
    lon: agent.lastTrueLon,
    headingDeg: agent.lastHeading,
    speedMps: agent.lastSpeed,
    batteryPct: Math.round(agent.battery),
    progressM: agent.progressM,
    routeLengthM: agent.route.lengthM,
    zoneName: zone?.name ?? "open road",
    zoneCategory: zone?.category ?? "none",
    score,
    silent: isSilent(agent, simMs),
    sosFired: agent.sosFired,
    insideIncidentZone: incident !== null,
  }
}

export function stepWorld(world: World, dtMs: number): StepResult {
  world.simMs += dtMs
  const pings: PingSample[] = []
  const sos: SosSample[] = []
  for (const agent of world.agents) {
    const result = stepAgent(world, agent, dtMs)
    if (result.ping) pings.push(result.ping)
    if (result.sos) sos.push(result.sos)
  }
  const featured = world.agents.find((a) => a.plan.featured) ?? world.agents[0]
  let countdownSec: number | null = null
  let countdownLabel: string | null = null
  if (world.plan.breachAtMs !== null && featured) {
    const remainMs = world.plan.breachAtMs - world.simMs
    countdownSec = Math.max(0, remainMs / 1000)
    countdownLabel = world.plan.breachZoneName
    if (featured.enteredRestricted) countdownSec = 0
  }
  return {
    simMs: world.simMs,
    pings,
    sos,
    snapshots: world.agents.map((a) => snapshot(a, world.simMs, world.originMs)),
    countdownSec,
    countdownLabel,
  }
}

/** Fast-forward without wall-clock sleeps. Returns every ping/SOS up to `totalSimMs`. */
export function runOffline(
  plan: SimPlan,
  rng: Rng,
  options: EngineOptions,
  totalSimMs: number,
  stepMs = 1000,
): { pings: PingSample[]; sos: SosSample[]; world: World } {
  const world = createWorld(plan, rng, options)
  const pings: PingSample[] = []
  const sos: SosSample[] = []
  while (world.simMs < totalSimMs) {
    const result = stepWorld(world, stepMs)
    pings.push(...result.pings)
    sos.push(...result.sos)
  }
  return { pings, sos, world }
}
