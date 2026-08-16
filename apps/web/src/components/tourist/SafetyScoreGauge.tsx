// apps/web/src/components/tourist/SafetyScoreGauge.tsx
"use client";

import { cn } from "@/lib/utils";

function scoreColor(score: number): string {
  if (score >= 80) return "#34d399";
  if (score >= 55) return "#fbbf24";
  if (score >= 35) return "#fb923c";
  return "#f87171";
}

export function SafetyScoreGauge({
  score,
  className,
}: {
  score: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, score));
  const r = 54;
  const c = 2 * Math.PI * r;
  const dash = (clamped / 100) * c;

  return (
    <div className={cn("relative mx-auto h-44 w-44", className)} aria-label={`Safety score ${clamped}`}>
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="currentColor"
          className="text-muted/40"
          strokeWidth="12"
        />
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke={scoreColor(clamped)}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          style={{ transition: "stroke-dasharray 700ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-5xl font-semibold tabular-nums tracking-tight">{clamped}</span>
        <span className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase">Safety</span>
      </div>
    </div>
  );
}
