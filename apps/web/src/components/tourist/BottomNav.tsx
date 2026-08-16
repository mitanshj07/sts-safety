// apps/web/src/components/tourist/BottomNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, IdCard, Map, Route, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/home", label: "Home", icon: Shield },
  { href: "/map", label: "Map", icon: Map },
  { href: "/trip", label: "Trip", icon: Route },
  { href: "/id", label: "ID", icon: IdCard },
  { href: "/alerts", label: "Alerts", icon: Bell },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  if (pathname.startsWith("/onboard")) return null;

  return (
    <nav
      aria-label="Tourist"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5 px-1">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "grid size-9 place-items-center rounded-xl transition-colors",
                    active && "bg-primary/15",
                  )}
                >
                  <Icon className="size-5" />
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
