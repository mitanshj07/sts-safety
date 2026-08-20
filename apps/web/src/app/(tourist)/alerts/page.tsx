// apps/web/src/app/(tourist)/alerts/page.tsx
"use client";

import { isCommandNoteNotification } from "@sts/shared";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { useTouristRuntime } from "@/components/tourist/TouristProvider";
import { formatIst } from "@/lib/ui/format";
import { cn } from "@/lib/utils";

export default function AlertsPage() {
  const { notifications, warning } = useTouristRuntime();
  const localWarning = warning
    ? [
        {
          id: "local-geofence",
          title: `Zone warning · ${warning.name}`,
          body: warning.advisory_text,
          channel: "device",
          status: "delivered",
          created_at: new Date().toISOString(),
          incident_id: null as string | null,
          provider_ref: null as string | null,
        },
      ]
    : [];
  const rows = [...localWarning, ...notifications];

  return (
    <main className="sts-enter mx-auto flex max-w-lg flex-col gap-4 px-4 py-6">
      <PageHeader
        kicker="Inbox"
        title="Alerts"
        description="Geofence warnings, SOS receipts, and notes from the control room."
        className="mb-0"
      />
      {rows.length === 0 ? (
        <EmptyState
          kicker="You're up to date"
          title="No notifications"
          description="Restricted-zone entries, SOS receipts, and control-room notes appear here."
        />
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {rows.map((n) => {
            const fromControl = isCommandNoteNotification(n);
            return (
              <li
                key={String(n.id)}
                className={cn("py-4", fromControl && "bg-success/10 px-3 -mx-0")}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{n.title ?? "Alert"}</p>
                  <p className="sts-meta shrink-0">
                    {fromControl ? "Control room" : n.channel}
                  </p>
                </div>
                {n.body ? <p className="mt-1 text-sm text-muted-foreground">{n.body}</p> : null}
                <p className="sts-meta mt-2">
                  {formatIst(n.created_at)} · {n.status}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
