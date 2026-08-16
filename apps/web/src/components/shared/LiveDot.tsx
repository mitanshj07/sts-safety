import { cn } from "@/lib/utils";

export function LiveDot({
  live = true,
  className,
}: {
  live?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex size-2", className)} aria-hidden="true">
      {live ? (
        <span className="live-ping absolute inline-flex size-full rounded-full bg-live opacity-60" />
      ) : null}
      <span
        className={cn(
          "relative inline-flex size-2 rounded-full",
          live ? "bg-live" : "bg-muted-foreground",
        )}
      />
    </span>
  );
}
