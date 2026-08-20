// apps/web/src/components/command/CommandShell.tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import {
  Activity,
  BadgeCheck,
  LayoutDashboard,
  MapPinned,
  MoreHorizontal,
  Radio,
  ShieldAlert,
  Users,
} from "lucide-react"
import { RealtimeProvider, useCommandRealtime } from "@/components/shared/RealtimeProvider"
import { AppMark } from "@/components/shared/AppMark"
import { LiveDot } from "@/components/shared/LiveDot"
import { CommandClock } from "@/components/command/CommandClock"
import { SignOutButton } from "@/components/auth/sign-out-button"
import { Toaster } from "@/components/ui/sonner"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import type { CommandSnapshot, ConnectionStatus } from "@/lib/command/types"

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, group: "ops" },
  { href: "/incidents", label: "Incidents", icon: ShieldAlert, group: "ops" },
  { href: "/tourists", label: "Tourists", icon: Users, group: "ops" },
  { href: "/verify", label: "Verify ID", icon: BadgeCheck, group: "field" },
  { href: "/zones", label: "Zones", icon: MapPinned, group: "geo" },
  { href: "/responders", label: "Responders", icon: Radio, group: "geo" },
  { href: "/analytics", label: "Analytics", icon: Activity, group: "geo" },
] as const

const MOBILE_TABS = [
  NAV[0],
  NAV[1],
  NAV[2],
  NAV[3],
] as const

function ConnectionPill({ status }: { status: ConnectionStatus }) {
  const live = status === "live"
  const label =
    status === "live"
      ? "LIVE"
      : status === "polling"
        ? "POLL"
        : status === "reconnecting"
          ? "RECONNECT"
          : status === "connecting"
            ? "CONNECT"
            : "OFFLINE"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-widest",
        live && "border-live/40 bg-live/15 text-live",
        status === "polling" && "border-severity-medium/40 bg-severity-medium/15 text-severity-medium",
        (status === "reconnecting" || status === "connecting") &&
          "border-border text-muted-foreground",
        status === "offline" && "border-broken/40 bg-broken/15 text-broken",
      )}
    >
      <LiveDot live={live} />
      {label}
    </span>
  )
}

function NavLinks({
  onNavigate,
  showLabels = true,
}: {
  onNavigate?: () => void
  showLabels?: boolean
}) {
  const pathname = usePathname()
  return (
    <div className="flex flex-col gap-0.5">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              !showLabels && "justify-center px-0 lg:justify-start lg:px-3",
              active && "bg-accent text-foreground",
              active && "lg:shadow-[inset_2px_0_0_0_var(--primary)]",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className={cn(!showLabels && "hidden lg:inline")}>{item.label}</span>
          </Link>
        )
      })}
    </div>
  )
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { connection, presence } = useCommandRealtime()
  const isDashboard = pathname === "/dashboard"
  const [moreOpen, setMoreOpen] = useState(false)
  const moreActive = ["/zones", "/responders", "/analytics"].some((href) =>
    pathname === href || pathname.startsWith(`${href}/`),
  )

  return (
    <div className="flex h-dvh min-h-0 bg-background text-foreground">
      <nav
        aria-label="Command"
        className="hidden w-16 flex-col border-r border-border bg-card py-3 md:flex lg:w-60"
      >
        <div className="mb-4 flex justify-center px-2 lg:justify-start lg:px-3">
          <AppMark compact className="lg:hidden" />
          <AppMark className="hidden lg:inline-flex" />
        </div>
        <div className="flex-1 px-1.5 lg:px-2">
          <NavLinks showLabels={false} />
        </div>
        <div className="hidden px-3 pt-2 lg:block">
          <p className="sts-kicker">Control room</p>
          <p className="mt-1 text-xs text-muted-foreground">{presence.length} operators present</p>
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-card/70 px-3 sm:px-4">
          <div className="min-w-0 md:hidden">
            <AppMark compact />
          </div>
          <div className="hidden min-w-0 md:block">
            <p className="sts-kicker">MDoNER · NE control room</p>
            <p className="truncate text-sm font-medium">Smart Tourist Safety</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <CommandClock />
            <ConnectionPill status={connection} />
            <span className="hidden font-mono text-[11px] text-muted-foreground xl:inline">
              {presence.length} ops
            </span>
            <SignOutButton />
          </div>
        </header>
        <div
          id="main"
          className={cn(
            "min-h-0 flex-1 pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-0",
            isDashboard ? "overflow-hidden" : "overflow-auto",
          )}
        >
          {children}
        </div>
      </div>

      <nav
        aria-label="Command mobile"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      >
        <ul className="grid grid-cols-5">
          {MOBILE_TABS.map((tab) => {
            const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`)
            const Icon = tab.icon
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {tab.label.replace(" ID", "")}
                </Link>
              </li>
            )
          })}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={cn(
                "flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
                moreActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              <MoreHorizontal className="size-4" aria-hidden />
              More
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl md:hidden">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="px-2 pb-6">
            <NavLinks onNavigate={() => setMoreOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
      <Toaster theme="dark" />
    </div>
  )
}

export function CommandShell({
  children,
  initial,
}: {
  children: React.ReactNode
  initial?: CommandSnapshot
}) {
  return (
    <RealtimeProvider initial={initial}>
      <ShellInner>{children}</ShellInner>
    </RealtimeProvider>
  )
}
