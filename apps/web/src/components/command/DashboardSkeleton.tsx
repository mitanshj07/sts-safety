// apps/web/src/components/command/DashboardSkeleton.tsx
import { Skeleton } from "@/components/ui/skeleton";

/** Fixed geometry matching the live dashboard — no layout shift. */
export function DashboardSkeleton() {
  return (
    <div className="flex h-full min-h-0 flex-col" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid h-[4.25rem] shrink-0 grid-cols-2 divide-x divide-border border-b border-border md:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col justify-center gap-2 px-3 py-2">
            <Skeleton className="h-2 w-16" />
            <Skeleton className="h-6 w-12" />
          </div>
        ))}
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1 bg-muted/40">
          <Skeleton className="absolute inset-0 rounded-none" />
        </div>
        <div className="hidden h-full w-[22rem] shrink-0 border-l border-border md:block">
          <div className="flex h-10 items-center justify-between border-b px-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-6" />
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2 border-b px-3 py-3">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4 p-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-72" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export function TouristPageSkeleton() {
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-6" aria-busy="true">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-36 w-full rounded-full self-center" />
      <Skeleton className="h-20 w-full rounded-xl" />
    </div>
  );
}
