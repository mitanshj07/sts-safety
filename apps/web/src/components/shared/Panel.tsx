import { cn } from "@/lib/utils";

export function Panel({
  className,
  ...props
}: React.ComponentProps<"section">) {
  return <section className={cn("sts-panel", className)} {...props} />;
}

export function PanelHeader({
  className,
  kicker,
  title,
  action,
  children,
}: {
  className?: string;
  kicker?: string;
  title?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 border-b border-border px-4 py-3",
        className,
      )}
    >
      <div className="min-w-0">
        {kicker ? <p className="sts-kicker">{kicker}</p> : null}
        {title ? <h2 className="text-sm font-semibold tracking-tight">{title}</h2> : null}
        {children}
      </div>
      {action}
    </div>
  );
}

export function PanelBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("p-4", className)} {...props} />;
}
