// apps/web/src/components/tourist/SafetyScoreGauge.tsx
"use client";

import { cn } from "@/lib/utils";

function scoreColor(score: number): string {
  if (score >= 80) return "var(--live)";
  if (score >= 55) return "var(--severity-medium)";
  if (score >= 35) return "var(--severity-high)";
  return "var(--severity-critical)";
}

export function SafetyScoreGauge({
  score,
  className,
}: {
  score: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, score));
  const r = 46;
  const c = 2 * Math.PI * r;
  const dash = (clamped / 100) * c;

  return (
    <div
      className={cn("relative mx-auto h-36 w-36", className)}
      aria-label={`Safety score ${clamped}`}
    >
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="currentColor"
          className="text-muted"
          strokeWidth="10"
        />
        <circle
          cx="60"
          cy="60"
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
        <span className="font-mono text-4xl font-semibold tabular-nums tracking-tight">
          {clamped}
        </span>
        <span className="sts-kicker mt-0.5">Safety</span>
      </div>
    </div>
  );
}
