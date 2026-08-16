// apps/web/src/lib/geo/ewkt.ts

export function pointEwkt(lon: number, lat: number): string {
  return `SRID=4326;POINT(${lon} ${lat})`;
}

export function roundCoord(n: number): number {
  return Math.round(n * 1e7) / 1e7;
}
