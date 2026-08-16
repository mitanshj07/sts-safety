// apps/web/src/components/command/SeverityBadge.tsx
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { IncidentStatus, SeverityLevel } from "@sts/shared"

const SEVERITY_CLASS: Record<SeverityLevel, string> = {
  critical: "border-severity-critical/40 bg-severity-critical/15 text-severity-critical",
  high: "border-severity-high/40 bg-severity-high/15 text-severity-high",
  medium: "border-severity-medium/40 bg-severity-medium/15 text-severity-medium",
  low: "border-severity-low/40 bg-severity-low/15 text-severity-low",
  info: "border-severity-info/40 bg-severity-info/15 text-severity-info",
}

/** Text marks so severity is never colour-only. */
const SEVERITY_MARK: Record<SeverityLevel, string> = {
  critical: "!!",
  high: "!",
  medium: "●",
  low: "○",
  info: "i",
}

export function SeverityBadge({ severity }: { severity: SeverityLevel }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-mono uppercase", SEVERITY_CLASS[severity])}
      aria-label={`Severity ${severity}`}
    >
      <span aria-hidden="true">{SEVERITY_MARK[severity]}</span>
      {severity}
    </Badge>
  )
}

export function StatusBadge({ status }: { status: IncidentStatus }) {
  return (
    <Badge variant="secondary" className="font-mono uppercase" aria-label={`Status ${status}`}>
      {status.replaceAll("_", " ")}
    </Badge>
  )
}
