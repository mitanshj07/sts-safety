// apps/web/src/components/command/SeverityBadge.tsx
import { cn } from "@/lib/utils"
import type { IncidentStatus, SeverityLevel } from "@sts/shared"

const SEVERITY_CLASS: Record<SeverityLevel, string> = {
  critical: "text-severity-critical",
  high: "text-severity-high",
  medium: "text-severity-medium",
  low: "text-severity-low",
  info: "text-severity-info",
}

const SEVERITY_RAIL: Record<SeverityLevel, string> = {
  critical: "bg-severity-critical",
  high: "bg-severity-high",
  medium: "bg-severity-medium",
  low: "bg-severity-low",
  info: "bg-severity-info",
}

/** Text marks so severity is never colour-only. */
const SEVERITY_MARK: Record<SeverityLevel, string> = {
  critical: "!!",
  high: "!",
  medium: "●",
  low: "○",
  info: "i",
}

export function SeverityRail({ severity }: { severity: SeverityLevel }) {
  return (
    <span
      className={cn("w-0.5 shrink-0 self-stretch", SEVERITY_RAIL[severity])}
      aria-hidden="true"
    />
  )
}

export function SeverityBadge({ severity }: { severity: SeverityLevel }) {
  return (
    <span
      className={cn("font-mono text-[11px] tracking-widest uppercase", SEVERITY_CLASS[severity])}
      aria-label={`Severity ${severity}`}
    >
      <span aria-hidden="true">{SEVERITY_MARK[severity]} </span>
      {severity}
    </span>
  )
}

export function StatusBadge({ status }: { status: IncidentStatus }) {
  return (
    <span
      className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase"
      aria-label={`Status ${status}`}
    >
      {(status ?? "unknown").replaceAll("_", " ")}
    </span>
  )
}
