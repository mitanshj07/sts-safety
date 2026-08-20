// apps/web/src/app/(auth)/layout.tsx
import Link from "next/link";

import { AppMark } from "@/components/shared/AppMark";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { TopoField } from "@/components/shared/TopoField";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="sts-topo relative flex min-h-screen flex-col">
      <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-6">
        <Link href="/" className="outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <AppMark />
        </Link>
        <ThemeToggle />
      </header>
      <div className="relative z-10 mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-4 py-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] lg:px-6">
        <aside className="hidden space-y-6 lg:block">
          <p className="sts-kicker text-brand">How to enter</p>
          <h1 className="sts-display text-4xl text-balance">A public-safety system, not a generic login.</h1>
          <ul className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">Tourist.</span> DigiLocker or onboarding, then the
              field PWA.
            </li>
            <li>
              <span className="font-medium text-foreground">Officer.</span> Command access for dispatch and
              verification.
            </li>
            <li>
              <span className="font-medium text-foreground">Demo.</span> Seeded accounts, clearly labelled —
              for evaluation, not live operations.
            </li>
          </ul>
          <TopoField className="h-56" />
        </aside>
        <div className="flex justify-center lg:justify-end">{children}</div>
      </div>
    </div>
  );
}
