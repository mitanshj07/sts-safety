"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { useTouristRuntime } from "@/components/tourist/TouristProvider";
import { Button } from "@/components/ui/button";
import { LiveDot } from "@/components/shared/LiveDot";

export function TouristTopBar() {
  const pathname = usePathname();
  const { online, tourist } = useTouristRuntime();

  if (pathname.startsWith("/onboard")) return null;

  const firstName = tourist?.full_name?.split(" ")[0] ?? "Traveller";

  return (
    <header className="sticky top-0 z-20 border-b border-border/80 bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex h-12 max-w-lg items-center justify-between gap-3 px-4">
        {pathname.startsWith("/sos") ? (
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/home">
              <ArrowLeft />
              Home
            </Link>
          </Button>
        ) : (
          <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
            <LiveDot live={online} />
            <span className="truncate">{firstName}</span>
            <span className="text-muted-foreground hidden font-normal sm:inline">
              · {online ? "connected" : "offline"}
            </span>
          </p>
        )}
        {pathname.startsWith("/sos") ? (
          <span className="sts-kicker text-sos">Emergency</span>
        ) : (
          <Button asChild variant="sos" size="sm">
            <Link href="/sos" aria-label="Open SOS">
              SOS
            </Link>
          </Button>
        )}
      </div>
    </header>
  );
}
