// apps/web/src/app/not-found.tsx
import Link from "next/link";

import { AppMark } from "@/components/shared/AppMark";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <main className="sts-mesh relative mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <AppMark />
      <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
        404
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-sm text-muted-foreground text-pretty">
        That route is not part of the tourist PWA or the command centre.
      </p>
      <div className="flex gap-2">
        <Button asChild>
          <Link href="/home">Tourist app</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard">Command centre</Link>
        </Button>
      </div>
    </main>
  );
}
