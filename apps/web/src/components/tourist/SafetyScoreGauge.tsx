// apps/web/src/components/tourist/SafetyScoreGauge.tsx
"use client";

import { cn } from "@/lib/utils";

function scoreColor(score: number): string {
  if (score >= 80) return "var(--success)";
  if (score >= 55) return "var(--warning)";
  if (score >= 35) return "var(--severity-high)";
  return "var(--danger)";
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Stable";
  if (score >= 55) return "Watch";
  if (score >= 35) return "Elevated risk";
  return "Urgent";
}

export function SafetyScoreGauge({
  score,
  className,
  compact = false,
}: {
  score: number;
  className?: string;
  compact?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, score));
  const r = 54;
  const c = 2 * Math.PI * r;
  const dash = (clamped / 100) * c;

  if (compact) {
    return (
      <div
        className={cn("flex items-center gap-3", className)}
        aria-label={`Safety score ${clamped}, ${scoreLabel(clamped)}`}
      >
        <div className="h-1.5 min-w-0 flex-1 overflow-hidden bg-muted">
          <div
            className="h-full transition-[width] duration-500"
            style={{ width: `${clamped}%`, background: scoreColor(clamped) }}
          />
        </div>
        <span className="font-mono text-lg tabular-nums">{clamped}</span>
        <span className="sts-kicker w-16 text-right">{scoreLabel(clamped)}</span>
      </div>
    );
  }

  return (
    <div className={cn("relative mx-auto h-36 w-36", className)} aria-label={`Safety score ${clamped}`}>
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="currentColor"
          className="text-muted"
          strokeWidth="10"
        />
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke={scoreColor(clamped)}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          style={{ transition: "stroke-dasharray 700ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-4xl font-medium tabular-nums tracking-tight">{clamped}</span>
        <span className="sts-kicker">Safety</span>
      </div>
    </div>
  );
}
