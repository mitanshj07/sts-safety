// apps/web/src/lib/pipeline/severity.ts
import "server-only"

import type { SeverityLevel } from "@sts/shared"

const ORDER: readonly SeverityLevel[] = [
  "info",
  "low",
  "medium",
  "high",
  "critical",
]

export function severityRank(level: string): number {
  const idx = ORDER.indexOf(level as SeverityLevel)
  return idx >= 0 ? idx : 2
}

export function escalateOne(level: string): SeverityLevel {
  const idx = severityRank(level)
  const next = ORDER[Math.min(idx + 1, ORDER.length - 1)]
  return next ?? "critical"
}

export function severityAtLeast(level: string, minimum: string): boolean {
  return severityRank(level) >= severityRank(minimum)
}
