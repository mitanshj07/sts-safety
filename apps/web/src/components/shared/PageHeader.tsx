import { cn } from "@/lib/utils";

export function PageHeader({
  kicker,
  title,
  description,
  actions,
  className,
}: {
  kicker?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn("mb-6 flex flex-wrap items-end justify-between gap-3", className)}
    >
      <div className="min-w-0 space-y-1">
        {kicker ? <p className="sts-kicker">{kicker}</p> : null}
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground text-pretty">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
