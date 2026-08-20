// apps/web/src/app/page.tsx
import Link from "next/link";

import { MapFoundationPreviewLazy as MapFoundationPreview } from "@/components/map/MapFoundationPreviewLazy";
import { AppMark } from "@/components/shared/AppMark";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { TopoField } from "@/components/shared/TopoField";
import { Button } from "@/components/ui/button";

const CAPABILITIES = [
  {
    title: "On-device geofence",
    body: "Restricted-zone warnings fire on the phone before the server round-trip.",
  },
  {
    title: "Hold-to-SOS",
    body: "An incident is written to Postgres. If the insert fails, SMS carries last coordinates.",
  },
  {
    title: "Verified tourist ID",
    body: "Indians sign in to DigiLocker and we fetch eAadhaar. Visitors use a passport. Only a keccak256 commitment goes on-chain.",
  },
  {
    title: "Live dispatch",
    body: "A shared operations map for checkpoints, police, and tourism officers.",
  },
] as const;

export default function HomePage() {
  return (
    <div className="sts-topo relative min-h-screen overflow-hidden">
      <a
        href="#enter"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:bg-surface focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to enter
      </a>
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-5 sm:px-6">
        <header className="flex items-center justify-between gap-4">
          <AppMark />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button asChild variant="outline" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </header>

        <main className="flex flex-1 flex-col justify-center gap-14 py-10 lg:py-14">
          <section
            id="enter"
            className="sts-enter grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14"
          >
            <div className="space-y-6">
              <p className="sts-kicker text-brand">Public safety · North-East India</p>
              <h1 className="sts-display text-[2.35rem] text-balance sm:text-5xl lg:text-[3.25rem]">
                Smart Tourist Safety
              </h1>
              <p className="max-w-xl text-base leading-7 text-muted-foreground text-pretty">
                Location-aware assistance when something goes wrong. Built for travellers
                on the ground, and for the officers who respond.
              </p>
              <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:flex-wrap">
                <Button asChild size="lg" className="min-h-11">
                  <Link href="/home" prefetch={false}>
                    Enter as Tourist
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="min-h-11">
                  <Link href="/login?tab=officer">Enter Command</Link>
                </Button>
              </div>
              <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-1 border-t border-border pt-5 text-sm sm:grid-cols-3">
                <div className="py-2">
                  <dt className="sts-kicker">For</dt>
                  <dd className="mt-1 text-foreground">Tourists, responders, authorities</dd>
                </div>
                <div className="py-2">
                  <dt className="sts-kicker">When</dt>
                  <dd className="mt-1 text-foreground">A zone warning, a missed check-in, an SOS</dd>
                </div>
                <div className="py-2">
                  <dt className="sts-kicker">Steward</dt>
                  <dd className="mt-1 text-foreground">MDoNER · SIH 2025</dd>
                </div>
              </dl>
            </div>

            <TopoField className="hidden min-h-[22rem] lg:block" />
          </section>

          <section className="sts-enter grid gap-8 border-t border-border pt-10 sm:grid-cols-2">
            <Link
              href="/home"
              prefetch={false}
              className="group block space-y-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <p className="sts-kicker">Tourist</p>
              <h2 className="text-xl font-semibold tracking-tight group-hover:text-brand">
                Digital ID, live zone, hold-to-SOS
              </h2>
              <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                DigiLocker eAadhaar, daylight-first PWA, one-handed SOS. Works when the hills go dark.
              </p>
            </Link>
            <Link
              href="/login?tab=officer"
              className="group block space-y-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <p className="sts-kicker">Command</p>
              <h2 className="text-xl font-semibold tracking-tight group-hover:text-brand">
                Triage, dispatch, checkpoint verify
              </h2>
              <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                A control room that answers what needs attention right now.
              </p>
            </Link>
          </section>

          <section className="sts-enter grid gap-0 border-y border-border sm:grid-cols-2 lg:grid-cols-4">
            {CAPABILITIES.map((item) => (
              <article
                key={item.title}
                className="border-border py-6 sm:px-5 sm:py-7 sm:odd:border-r lg:border-r lg:last:border-r-0"
              >
                <h3 className="text-sm font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </article>
            ))}
          </section>

          <section className="sts-enter space-y-3">
            <div>
              <p className="sts-kicker">Shared operations map</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight">
                Same canvas for tourists and the control room
              </h2>
            </div>
            <MapFoundationPreview />
          </section>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border py-5 text-xs text-muted-foreground">
          <p>Smart Tourist Safety Monitoring & Incident Response</p>
          <p>Ministry of Development of North Eastern Region</p>
        </footer>
      </div>
    </div>
  );
}
