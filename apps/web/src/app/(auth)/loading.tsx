// apps/web/src/app/(auth)/loading.tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function AuthLoading() {
  return (
    <div className="w-full max-w-md space-y-4 rounded-xl border p-6" aria-busy="true">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
