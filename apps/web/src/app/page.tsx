// apps/web/src/app/page.tsx
import Link from "next/link";
import {
  BadgeCheck,
  MapPinned,
  Radio,
  ShieldAlert,
  Smartphone,
  WifiOff,
} from "lucide-react";

import { MapFoundationPreviewLazy as MapFoundationPreview } from "@/components/map/MapFoundationPreviewLazy";
import { AppMark } from "@/components/shared/AppMark";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: WifiOff,
    title: "Offline geofence",
    body: "Restricted-zone warnings fire on-device before the server round-trip.",
  },
  {
    icon: ShieldAlert,
    title: "Hold-to-SOS",
    body: "Incident written to Postgres. If the insert fails, SMS with last coordinates.",
  },
  {
    icon: BadgeCheck,
    title: "Soulbound digital ID",
    body: "Indians fetch eAadhaar via DigiLocker (or type Aadhaar). Visitors use a passport. Only a keccak256 commitment goes on-chain.",
  },
  {
    icon: Radio,
    title: "Live command room",
    body: "Critical-first queue, nearest-unit dispatch, MTTA/MTTR on a shared map.",
  },
] as const;

export default function HomePage() {
  return (
    <div className="sts-mesh sts-grain relative min-h-screen overflow-hidden">
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-6">
        <header className="flex items-center justify-between gap-4">
          <AppMark />
          <Button asChild variant="outline" size="sm">
            <Link href="/login">Sign in</Link>
          </Button>
        </header>

        <main className="flex flex-1 flex-col justify-center gap-12 py-12 lg:py-16">
          <section className="sts-enter grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <p className="text-xs font-medium tracking-[0.28em] text-primary uppercase">
                SIH 2025 · MDoNER · North-East
              </p>
              <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
                Safety that works when the hills go dark.
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-muted-foreground text-pretty">
                A tourist PWA with offline geofencing, SOS, and a soulbound ID — paired with
                a live control room for checkpoints, police, and tourism officers.
              </p>
              <div className="flex flex-wrap gap-3 pt-1">
                <Button asChild size="lg">
                  <a href="/api/identity/digilocker/start?intent=signup">
                    Continue with DigiLocker
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/login?tab=tourist">Tourist sign in</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/login?tab=officer">Command centre</Link>
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                href="/login?tab=tourist"
                className="group rounded-2xl border border-border/80 bg-card/70 p-5 shadow-sm backdrop-blur-sm transition-colors hover:border-primary/40 hover:bg-card"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-live/15 text-live">
                  <Smartphone className="size-5" />
                </span>
                <h2 className="mt-4 text-lg font-semibold">Tourist</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  DigiLocker eAadhaar, digital ID, live map, and a 1.5s panic hold.
                </p>
                <p className="mt-4 text-xs font-medium tracking-wide text-primary">
                  Sign in or fetch KYC →
                </p>
              </Link>
              <Link
                href="/login?tab=officer"
                className="group rounded-2xl border border-border/80 bg-card/70 p-5 shadow-sm backdrop-blur-sm transition-colors hover:border-primary/40 hover:bg-card"
              >
                <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
                  <MapPinned className="size-5" />
                </span>
                <h2 className="mt-4 text-lg font-semibold">Command</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ops map, incident queue, dispatch, and checkpoint verify.
                </p>
                <p className="mt-4 text-xs font-medium tracking-wide text-primary">
                  Enter control room →
                </p>
              </Link>
            </div>
          </section>

          <section className="sts-enter grid gap-3 sm:grid-cols-2 lg:grid-cols-4" style={{ animationDelay: "80ms" }}>
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <article
                  key={feature.title}
                  className="rounded-2xl border border-border/70 bg-card/50 p-4 backdrop-blur-sm"
                >
                  <Icon className="size-4 text-primary" />
                  <h3 className="mt-3 text-sm font-semibold">{feature.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {feature.body}
                  </p>
                </article>
              );
            })}
          </section>

          <section className="sts-enter space-y-3" style={{ animationDelay: "140ms" }}>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
                  Shared map stack
                </p>
                <h2 className="text-lg font-semibold tracking-tight">
                  MapLibre · OpenFreeMap · same canvas for both personas
                </h2>
              </div>
            </div>
            <MapFoundationPreview />
          </section>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 py-5 text-xs text-muted-foreground">
          <p>Smart Tourist Safety Monitoring & Incident Response</p>
          <p>Ministry of Development of North Eastern Region</p>
        </footer>
      </div>
    </div>
  );
}
