import { cn } from "@/lib/utils";

export function AppMark({
  className,
  compact = false,
  inverted = false,
}: {
  className?: string;
  compact?: boolean;
  inverted?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-lg",
          inverted
            ? "bg-background text-foreground"
            : "bg-primary text-primary-foreground",
        )}
        aria-hidden="true"
      >
        <svg viewBox="0 0 32 32" className="size-5" fill="none">
          <path
            d="M16 3.5 6.5 8.2v7.4c0 6.3 4.1 10.7 9.5 12.9 5.4-2.2 9.5-6.6 9.5-12.9V8.2L16 3.5Z"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinejoin="round"
          />
          <path
            d="M8.8 19.2 13.2 14l3.2 3.4 6.8-7.6"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {compact ? null : (
        <span className="leading-tight">
          <span className="sts-kicker block">MDoNER</span>
          <span className="block text-sm font-semibold tracking-tight">STS Safety</span>
        </span>
      )}
    </span>
  );
}
