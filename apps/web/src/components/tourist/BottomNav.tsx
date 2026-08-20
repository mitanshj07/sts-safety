// apps/web/src/components/tourist/BottomNav.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, IdCard, Map, MoreHorizontal, Route, Shield } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const PRIMARY = [
  { href: "/home", label: "Home", icon: Shield },
  { href: "/map", label: "Map", icon: Map },
] as const;

const MORE = [
  { href: "/trip", label: "Trip", icon: Route, body: "Corridor and waypoint check-ins" },
  { href: "/alerts", label: "Alerts", icon: Bell, body: "Zone warnings and control-room notes" },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  if (pathname.startsWith("/onboard")) return null;

  const moreActive = MORE.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  return (
    <>
      <nav
        aria-label="Tourist"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5 px-1">
          {PRIMARY.map((tab) => {
            const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            const Icon = tab.icon;
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} />
                  {tab.label}
                </Link>
              </li>
            );
          })}
          <li>
            <Link
              href="/sos"
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold tracking-wide",
                pathname.startsWith("/sos") ? "text-danger" : "text-danger/90 hover:text-danger",
              )}
            >
              <span className="grid size-9 place-items-center rounded-full bg-danger text-[10px] tracking-[0.14em] text-white">
                SOS
              </span>
              Safety
            </Link>
          </li>
          <li>
            <Link
              href="/id"
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                pathname === "/id" || pathname.startsWith("/id/")
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <IdCard
                className="size-5"
                strokeWidth={pathname === "/id" || pathname.startsWith("/id/") ? 2.25 : 1.75}
              />
              Profile
            </Link>
          </li>
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={cn(
                "flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                moreActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <MoreHorizontal className="size-5" />
              More
            </button>
          </li>
        </ul>
      </nav>
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-lg pb-[env(safe-area-inset-bottom)]">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
            <SheetDescription>Trip tools and alerts. SOS stays on the bar.</SheetDescription>
          </SheetHeader>
          <ul className="space-y-1 px-4 pb-6">
            {MORE.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className="flex min-h-14 items-center gap-3 border-b border-border py-3"
                  >
                    <Icon className="size-5 text-muted-foreground" />
                    <span>
                      <span className="block text-sm font-medium">{item.label}</span>
                      <span className="block text-xs text-muted-foreground">{item.body}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}
