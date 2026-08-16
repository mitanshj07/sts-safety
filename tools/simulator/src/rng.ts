// tools/simulator/src/rng.ts
/** Mulberry32 — small, seedable, byte-stable across Node versions. */
export type Rng = {
  next: () => number
  int: (min: number, max: number) => number
  gauss: (mean?: number, sigma?: number) => number
  pick: <T>(items: readonly T[]) => T
  fork: (salt: number) => Rng
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0
  if (state === 0) state = 0x9e3779b9

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const int = (min: number, max: number): number => {
    if (max < min) throw new RangeError("rng.int: max < min")
    return min + Math.floor(next() * (max - min + 1))
  }

  const gauss = (mean = 0, sigma = 1): number => {
    let u = 0
    let v = 0
    while (u === 0) u = next()
    while (v === 0) v = next()
    const mag = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
    return mean + sigma * mag
  }

  const pick = <T>(items: readonly T[]): T => {
    const item = items[int(0, items.length - 1)]
    if (item === undefined) throw new RangeError("rng.pick: empty list")
    return item
  }

  const fork = (salt: number): Rng => createRng((state ^ (salt >>> 0)) >>> 0)

  return { next, int, gauss, pick, fork }
}
