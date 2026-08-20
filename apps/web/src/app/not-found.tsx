// apps/web/src/app/not-found.tsx
import Link from "next/link";

import { AppMark } from "@/components/shared/AppMark";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <main
      id="main"
      className="sts-mesh relative mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center"
    >
      <AppMark />
      <p className="sts-kicker">404</p>
      <h1 className="sts-display text-4xl">This route is not on the map.</h1>
      <p className="text-sm text-muted-foreground text-pretty">
        That path is not part of the tourist PWA or the command centre.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
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
