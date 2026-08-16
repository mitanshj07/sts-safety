// apps/web/src/lib/tourist/time-windows.ts
import type { RiskLevel } from "@/lib/geo/risk-colors";
import { riskFromUnknown } from "@/lib/geo/risk-colors";

type TimeWindow = {
  days: number[];
  from: string;
  to: string;
  risk_level: string;
};

function parseWindows(raw: unknown): TimeWindow[] {
  if (!Array.isArray(raw)) return [];
  const out: TimeWindow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const daysRaw = rec.days;
    const days = Array.isArray(daysRaw)
      ? daysRaw.map((d) => Number(d)).filter((n) => Number.isFinite(n))
      : [];
    if (typeof rec.from !== "string" || typeof rec.to !== "string") continue;
    out.push({
      days,
      from: rec.from,
      to: rec.to,
      risk_level: typeof rec.risk_level === "string" ? rec.risk_level : "low",
    });
  }
  return out;
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":");
  return Number(h) * 60 + Number(m);
}

export function effectiveRisk(
  base: RiskLevel,
  timeWindows: unknown,
  at: Date = new Date(),
): RiskLevel {
  const windows = parseWindows(timeWindows);
  if (windows.length === 0) return base;

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);

  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const dowMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dow = dowMap[weekday] ?? at.getDay();
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const nowMin = hour * 60 + minute;

  for (const w of windows) {
    if (!w.days.includes(dow)) continue;
    const from = timeToMinutes(w.from);
    const to = timeToMinutes(w.to);
    const inWindow =
      from <= to ? nowMin >= from && nowMin <= to : nowMin >= from || nowMin <= to;
    if (inWindow) return riskFromUnknown(w.risk_level);
  }
  return base;
}

const BREACH_CATEGORIES = new Set(["restricted", "high_risk", "border"]);

export function isBreachZone(category: string, risk: RiskLevel): boolean {
  if (BREACH_CATEGORIES.has(category)) return true;
  return risk === "high" || risk === "critical";
}
