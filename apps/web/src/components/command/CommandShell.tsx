// apps/web/src/components/command/CommandShell.tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity,
  BadgeCheck,
  LayoutDashboard,
  MapPinned,
  Radio,
  ShieldAlert,
  Users,
  Waypoints,
} from "lucide-react"
import { RealtimeProvider, useCommandRealtime } from "@/components/shared/RealtimeProvider"
import { AppMark } from "@/components/shared/AppMark"
import { LiveDot } from "@/components/shared/LiveDot"
import { CommandClock } from "@/components/command/CommandClock"
import { SignOutButton } from "@/components/auth/sign-out-button"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
import type { CommandSnapshot, ConnectionStatus } from "@/lib/command/types"

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/incidents", label: "Incidents", icon: ShieldAlert },
  { href: "/tourists", label: "Tourists", icon: Users },
  { href: "/zones", label: "Zones", icon: MapPinned },
  { href: "/responders", label: "Responders", icon: Radio },
  { href: "/analytics", label: "Analytics", icon: Activity },
  { href: "/verify", label: "Verify ID", icon: BadgeCheck },
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
      <Waypoints className="size-3" />
      {label}
    </span>
  )
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { connection, presence } = useCommandRealtime()
  const isDashboard = pathname === "/dashboard"

  return (
    <div className="flex h-dvh min-h-0 bg-background text-foreground">
      <nav className="flex w-14 flex-col border-r border-border bg-card/80 py-3 lg:w-56">
        <div className="mb-3 flex justify-center px-2 lg:justify-start lg:px-3">
          <AppMark compact className="lg:hidden" />
          <AppMark className="hidden lg:inline-flex" />
        </div>
        <div className="flex flex-1 flex-col gap-0.5 px-1.5 lg:px-2">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={cn(
                  "flex items-center justify-center gap-3 rounded-lg px-0 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:justify-start lg:px-3",
                  active && "bg-accent text-foreground shadow-[inset_2px_0_0_0_var(--primary)]",
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="hidden text-sm font-medium lg:inline">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center justify-between gap-3 border-b border-border bg-card/40 px-4">
          <div className="min-w-0">
            <p className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
              MDoNER · NE control room
            </p>
            <p className="truncate text-sm font-medium">Smart Tourist Safety</p>
          </div>
          <div className="flex items-center gap-3">
            <CommandClock />
            <ConnectionPill status={connection} />
            <span className="hidden font-mono text-[11px] text-muted-foreground md:inline">
              {presence.length} ops
            </span>
            <SignOutButton />
          </div>
        </header>
        <div className={cn("min-h-0 flex-1", isDashboard ? "overflow-hidden" : "overflow-auto")}>
          {children}
        </div>
      </div>
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
