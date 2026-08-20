// apps/web/src/app/page.tsx
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Radio,
  ShieldAlert,
  Smartphone,
  WifiOff,
} from "lucide-react";

import { MapFoundationPreviewLazy as MapFoundationPreview } from "@/components/map/MapFoundationPreviewLazy";
import { AppMark } from "@/components/shared/AppMark";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    n: "01",
    title: "Issue a soulbound ID",
    body: "Indian travellers fetch eAadhaar via DigiLocker. Visitors use a passport. Only a keccak256 commitment goes on-chain.",
  },
  {
    n: "02",
    title: "Geofence in Postgres",
    body: "Pings evaluate inside PostGIS. Restricted-zone warnings also fire on-device, before the network round-trip.",
  },
  {
    n: "03",
    title: "Dispatch in under two seconds",
    body: "SOS writes straight to incidents. Telegram, push, and the control room fan out after the row exists — never before.",
  },
] as const;

const PROOFS = [
  {
    icon: WifiOff,
    title: "Offline first",
    body: "Turf.js on the phone. IndexedDB queue. SMS fallback if the insert fails.",
  },
  {
    icon: ShieldAlert,
    title: "Hold-to-SOS",
    body: "1.5s confirm. Direct RLS insert. No serverless hop on the hot path.",
  },
  {
    icon: BadgeCheck,
    title: "Selective disclosure",
    body: "Hotels verify the ID without seeing the passport number.",
  },
  {
    icon: Radio,
    title: "Live ops room",
    body: "Critical-first queue, nearest-unit dispatch, MTTA and MTTR on one map.",
  },
] as const;

export default function HomePage() {
  return (
    <div className="dark sts-mesh sts-ridge relative min-h-screen overflow-x-hidden">
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-6">
        <AppMark />
        <nav className="flex items-center gap-2" aria-label="Primary">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/login?tab=officer">Command</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
        </nav>
      </header>

      <main id="main" className="relative z-10 mx-auto flex w-full max-w-6xl flex-col px-5 pb-16 sm:px-6">
        <section className="sts-enter grid items-end gap-10 py-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:py-16">
          <div className="max-w-xl space-y-6">
            <p className="sts-kicker text-primary">
              SIH 2025 · MDoNER · North-East India
            </p>
            <h1 className="sts-display text-4xl text-foreground sm:text-5xl lg:text-[3.4rem]">
              Safety that still works when the hills go dark.
            </h1>
            <p className="text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">
              A tourist PWA with offline geofencing and hold-to-SOS, paired with a live
              control room for checkpoints, police, and tourism officers. Blockchain and
              AI sit beside the path — they never gate an alert.
            </p>
            <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:flex-wrap">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href="/login?tab=tourist">
                  Open tourist app
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full border-white/20 sm:w-auto">
                <Link href="/login?tab=officer">Enter command centre</Link>
              </Button>
            </div>
            <dl className="grid grid-cols-3 gap-3 border-t border-border/70 pt-6">
              <div>
                <dt className="sts-kicker">Hot path</dt>
                <dd className="mt-1 font-mono text-sm font-medium tabular-nums">180–450 ms</dd>
              </div>
              <div>
                <dt className="sts-kicker">Infra</dt>
                <dd className="mt-1 text-sm font-medium">₹0 · no card</dd>
              </div>
              <div>
                <dt className="sts-kicker">PII on-chain</dt>
                <dd className="mt-1 text-sm font-medium">Never</dd>
              </div>
            </dl>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/login?tab=tourist"
              className="sts-panel group flex flex-col p-5 transition-colors hover:border-primary/40 hover:bg-elevated"
            >
              <span className="bg-live/15 text-live grid size-10 place-items-center rounded-lg">
                <Smartphone className="size-5" aria-hidden />
              </span>
              <h2 className="mt-5 text-lg font-semibold tracking-tight">Traveller</h2>
              <p className="mt-1 flex-1 text-sm leading-relaxed text-muted-foreground">
                Digital ID, live map, trip check-ins, and a 1.5s panic hold — usable in
                sunlight and offline.
              </p>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary">
                Continue as tourist
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
            <Link
              href="/login?tab=officer"
              className="sts-panel group flex flex-col p-5 transition-colors hover:border-primary/40 hover:bg-elevated"
            >
              <span className="bg-primary/15 text-primary grid size-10 place-items-center rounded-lg">
                <Radio className="size-5" aria-hidden />
              </span>
              <h2 className="mt-5 text-lg font-semibold tracking-tight">Control room</h2>
              <p className="mt-1 flex-1 text-sm leading-relaxed text-muted-foreground">
                Ops map, critical-first queue, dispatch, checkpoint verify, and E-FIR.
              </p>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-primary">
                Continue as officer
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </div>
        </section>

        <section className="sts-enter border-t border-border/70 py-12" style={{ animationDelay: "70ms" }}>
          <p className="sts-kicker">How an alert is born</p>
          <h2 className="sts-display mt-2 max-w-xl text-3xl">
            Three steps. Nothing clever sits on the critical path.
          </h2>
          <ol className="mt-8 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
            {STEPS.map((step) => (
              <li key={step.n} className="bg-card p-5">
                <p className="font-mono text-xs text-primary">{step.n}</p>
                <h3 className="mt-3 text-base font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="sts-enter py-4" style={{ animationDelay: "110ms" }}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PROOFS.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="rounded-xl px-1 py-4 sm:px-2">
                  <Icon className="size-4 text-primary" aria-hidden />
                  <h3 className="mt-3 text-sm font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="sts-enter space-y-4 pt-6" style={{ animationDelay: "150ms" }}>
          <div>
            <p className="sts-kicker">Shared map stack</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">
              MapLibre · OpenFreeMap · one canvas for both personas
            </h2>
          </div>
          <MapFoundationPreview />
        </section>
      </main>

      <footer className="relative z-10 mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 border-t border-border/70 px-5 py-6 text-xs text-muted-foreground sm:px-6">
        <p>Smart Tourist Safety Monitoring &amp; Incident Response</p>
        <p>Ministry of Development of North Eastern Region</p>
      </footer>
    </div>
  );
}
