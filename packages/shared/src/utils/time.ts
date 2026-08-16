// packages/shared/src/utils/time.ts
const IST = "Asia/Kolkata"

export function toDate(value: Date | string | number): Date {
  if (value instanceof Date) return value
  if (typeof value === "number") {
    const ms = value < 1e12 ? value * 1000 : value
    return new Date(ms)
  }
  return new Date(value)
}

/** Hour of day in Asia/Kolkata, 0–23. */
export function istHour(at: Date | string | number): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST,
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(toDate(at))
  const hour = parts.find((part) => part.type === "hour")?.value
  return Number(hour ?? "0")
}

export function toUnixSeconds(value: Date | string | number): number {
  if (typeof value === "number") {
    return value < 1e12 ? Math.floor(value) : Math.floor(value / 1000)
  }
  return Math.floor(toDate(value).getTime() / 1000)
}
