import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  kicker,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  kicker?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex max-w-md flex-col gap-2 py-14", className)}>
      {kicker ? <p className="sts-kicker">{kicker}</p> : null}
      <div className="flex items-baseline gap-2">
        {Icon ? <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{description}</p>
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}
