import { Shield } from "lucide-react";

import { cn } from "@/lib/utils";

export function AppMark({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="grid size-8 shrink-0 place-items-center border border-border bg-primary text-primary-foreground">
        <Shield className="size-4" strokeWidth={2} />
      </span>
      {compact ? null : (
        <span className="leading-tight">
          <span className="block text-[10px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
            MDoNER
          </span>
          <span className="block text-sm font-semibold tracking-tight">STS Safety</span>
        </span>
      )}
    </span>
  );
}
