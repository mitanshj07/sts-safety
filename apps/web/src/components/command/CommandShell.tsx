// apps/web/src/components/command/CommandShell.tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
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
import { ThemeToggle } from "@/components/shared/ThemeToggle"
import { CommandClock } from "@/components/command/CommandClock"
import { SignOutButton } from "@/components/auth/sign-out-button"
import { Toaster } from "@/components/ui/sonner"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import type { CommandSnapshot, ConnectionStatus } from "@/lib/command/types"

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/incidents", label: "Incidents", icon: ShieldAlert },
  { href: "/tourists", label: "Tourists", icon: Users },
  { href: "/verify", label: "Verify", icon: BadgeCheck },
  { href: "/responders", label: "Dispatch", icon: Radio },
  { href: "/analytics", label: "Analytics", icon: Activity },
  { href: "/zones", label: "Zones", icon: MapPinned },
] as const

const MOBILE_PRIMARY = NAV.slice(0, 3)

function connectionCopy(status: ConnectionStatus): { kicker: string; live: boolean } {
  if (status === "live") return { kicker: "Online", live: true }
  if (status === "offline") return { kicker: "Offline", live: false }
  return { kicker: "Syncing", live: false }
}

function ConnectionPill({ status }: { status: ConnectionStatus }) {
  const { kicker, live } = connectionCopy(status)
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] tracking-widest uppercase",
        live && "border-success/35 text-success",
        status === "offline" && "border-danger/35 text-danger",
        !live && status !== "offline" && "border-warning/35 text-warning",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          live ? "bg-success" : status === "offline" ? "bg-danger" : "bg-warning",
        )}
        aria-hidden
      />
      {kicker}
    </span>
  )
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  compact,
}: {
  href: string
  label: string
  icon: (typeof NAV)[number]["icon"]
  active: boolean
  compact?: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-11 items-center gap-3 px-3 text-sm transition-colors",
        compact && "min-h-12 flex-col justify-center gap-0.5 px-2 text-[11px]",
        active
          ? "bg-accent text-foreground md:shadow-[inset_2px_0_0_0_var(--brand)]"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className={cn("font-medium", compact && "leading-none")}>{label}</span>
    </Link>
  )
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { connection, presence } = useCommandRealtime()
  const isDashboard = pathname === "/dashboard"
  const [moreOpen, setMoreOpen] = useState(false)
  const moreActive = NAV.slice(3).some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  )

  return (
    <div className="flex h-dvh min-h-0 bg-background text-foreground">
      <nav
        aria-label="Command"
        className="hidden w-56 shrink-0 flex-col border-r border-border bg-surface md:flex"
      >
        <div className="border-b border-border px-3 py-3">
          <AppMark />
        </div>
        <div className="flex flex-1 flex-col gap-0.5 py-2">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                active={active}
              />
            )
          })}
        </div>
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 items-center justify-between gap-3 border-b border-border bg-surface px-4">
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
            <span className="hidden font-mono text-[11px] text-muted-foreground lg:inline">
              {presence.length} ops
            </span>
            <ThemeToggle />
            <SignOutButton />
          </div>
        </header>
        <div className={cn("min-h-0 flex-1", isDashboard ? "overflow-hidden" : "overflow-auto")}>
          {children}
        </div>
        <nav
          aria-label="Command mobile"
          className="grid grid-cols-4 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          {MOBILE_PRIMARY.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                active={active}
                compact
              />
            )
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              "flex min-h-12 flex-col items-center justify-center gap-0.5 text-[11px] font-medium",
              moreActive ? "text-foreground" : "text-muted-foreground",
            )}
          >
            <MoreHorizontal className="size-4" />
            More
          </button>
        </nav>
      </div>
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="md:hidden">
          <SheetHeader>
            <SheetTitle>Command</SheetTitle>
            <SheetDescription>Verify, dispatch, analytics, and zones.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col pb-6">
            {NAV.slice(3).map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex min-h-12 items-center gap-3 border-b border-border px-4 text-sm",
                    active ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </SheetContent>
      </Sheet>
      <Toaster />
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
