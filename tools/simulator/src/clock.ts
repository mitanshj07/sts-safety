// tools/simulator/src/clock.ts
/** Simulated clock. `speed` multiplies elapsed wall time into sim time. */
export class SimClock {
  readonly originMs: number
  readonly speed: number
  private wallOriginMs: number
  private simMs: number

  constructor(originIso: string, speed: number) {
    this.originMs = Date.parse(originIso)
    this.speed = speed
    this.wallOriginMs = Date.now()
    this.simMs = 0
  }

  get millis(): number {
    return this.simMs
  }

  get iso(): string {
    return new Date(this.originMs + this.simMs).toISOString()
  }

  /** Advance by `wallDtMs` of real time (multiplied by speed). */
  tickWall(wallDtMs: number): number {
    const dt = wallDtMs * this.speed
    this.simMs += dt
    return dt
  }

  /** Advance simulated time directly (offline / replay generation). */
  tickSim(dtMs: number): number {
    this.simMs += dtMs
    return dtMs
  }

  catchUpFromWall(): number {
    const target = (Date.now() - this.wallOriginMs) * this.speed
    const dt = Math.max(0, target - this.simMs)
    this.simMs += dt
    return dt
  }
}

export function formatHms(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => n.toString().padStart(2, "0")
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}
