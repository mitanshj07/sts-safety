import { cn } from "@/lib/utils";

export function TopoField({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden border border-border bg-surface",
        className,
      )}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 480 420"
        className="h-full w-full text-foreground/18"
        fill="none"
      >
        <rect width="480" height="420" className="fill-background" />
        {[
          "M40 360 C 90 330, 130 300, 170 250 S 230 160, 280 140 S 360 110, 440 70",
          "M30 300 C 100 280, 150 240, 190 200 S 250 130, 310 120 S 390 90, 460 50",
          "M20 250 C 80 240, 140 210, 180 170 S 250 100, 330 95 S 400 70, 470 40",
        ].map((d) => (
          <path key={d} d={d} stroke="currentColor" strokeWidth="1" />
        ))}
        <ellipse cx="278" cy="148" rx="86" ry="52" stroke="currentColor" strokeWidth="1" />
        <ellipse cx="278" cy="148" rx="58" ry="34" stroke="currentColor" strokeWidth="1" />
        <ellipse cx="278" cy="148" rx="32" ry="18" stroke="currentColor" strokeWidth="1" />
        <path
          d="M64 388 C 140 340, 210 220, 278 148 S 390 70, 452 36"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="5 7"
          className="text-brand"
        />
        <circle cx="278" cy="148" r="3.5" className="fill-brand" />
        <line x1="16" y1="16" x2="16" y2="404" stroke="currentColor" strokeWidth="0.6" />
        <line x1="16" y1="404" x2="464" y2="404" stroke="currentColor" strokeWidth="0.6" />
        {Array.from({ length: 8 }).map((_, i) => (
          <line
            key={`y-${i}`}
            x1="12"
            x2="16"
            y1={16 + i * 48}
            y2={16 + i * 48}
            stroke="currentColor"
            strokeWidth="0.8"
          />
        ))}
        {Array.from({ length: 9 }).map((_, i) => (
          <line
            key={`x-${i}`}
            y1="404"
            y2="408"
            x1={16 + i * 56}
            x2={16 + i * 56}
            stroke="currentColor"
            strokeWidth="0.8"
          />
        ))}
      </svg>
      <div className="absolute right-4 bottom-4 left-4 flex items-end justify-between gap-3">
        <div>
          <p className="sts-kicker">Field note</p>
          <p className="sts-meta mt-1 text-foreground">26.57750°N  93.17110°E</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Kaziranga · Assam</p>
        </div>
        <p className="sts-meta">NE control grid</p>
      </div>
    </div>
  );
}
