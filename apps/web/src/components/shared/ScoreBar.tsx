import { cn } from "@/lib/utils";

function tone(score: number): string {
  if (score >= 80) return "bg-live";
  if (score >= 55) return "bg-severity-medium";
  if (score >= 35) return "bg-severity-high";
  return "bg-severity-critical";
}

export function ScoreBar({
  score,
  className,
}: {
  score: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, score));
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-[width]", tone(clamped))}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="font-mono text-xs tabular-nums">{clamped}</span>
    </div>
  );
}
