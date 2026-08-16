// apps/web/src/lib/geo/geohash.ts
/** Geohash precision 7 ≈ 153 m × 153 m — the 100 m cache cell. */
const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz"
export const GEOHASH_PRECISION_100M = 7

export function geohashEncode(
  lat: number,
  lon: number,
  precision = GEOHASH_PRECISION_100M,
): string {
  let minLat = -90
  let maxLat = 90
  let minLon = -180
  let maxLon = 180
  let hash = ""
  let bit = 0
  let ch = 0
  let even = true
  while (hash.length < precision) {
    if (even) {
      const mid = (minLon + maxLon) / 2
      if (lon >= mid) {
        ch |= 1 << (4 - bit)
        minLon = mid
      } else {
        maxLon = mid
      }
    } else {
      const mid = (minLat + maxLat) / 2
      if (lat >= mid) {
        ch |= 1 << (4 - bit)
        minLat = mid
      } else {
        maxLat = mid
      }
    }
    even = !even
    if (bit < 4) {
      bit += 1
    } else {
      const glyph = BASE32[ch]
      hash += glyph ?? ""
      bit = 0
      ch = 0
    }
  }
  return hash
}
