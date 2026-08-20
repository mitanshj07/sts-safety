// apps/web/src/components/tourist/SosReplyThread.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { isCommandNoteNotification } from "@sts/shared";
import { IncidentMessageThread } from "@/components/shared/IncidentMessageThread";
import { useTouristRuntime } from "@/components/tourist/TouristProvider";
import { getBrowserSupabase } from "@/lib/supabase/client";

type OpenSos = { id: string; status: string; occurred_at: string };

export function SosReplyThread({
  className,
  onlyWhenOpen = false,
}: {
  className?: string
  onlyWhenOpen?: boolean
}) {
  const { tourist, notifications, refreshSession } = useTouristRuntime();
  const [openSos, setOpenSos] = useState<OpenSos | null>(null);
  const [forcedOpen, setForcedOpen] = useState(false);

  useEffect(() => {
    const onSos = () => setForcedOpen(true);
    window.addEventListener("sts:sos", onSos);
    return () => window.removeEventListener("sts:sos", onSos);
  }, []);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    const touristId = tourist?.id;
    if (!supabase || !touristId) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("incidents")
        .select("id, status, occurred_at")
        .eq("tourist_id", touristId)
        .eq("type", "sos")
        .in("status", ["open", "acknowledged", "dispatched"])
        .order("occurred_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (data && typeof data.id === "string") {
        setOpenSos({
          id: data.id,
          status: String(data.status),
          occurred_at: String(data.occurred_at),
        });
      } else {
        setOpenSos(null);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [tourist?.id, notifications.length, forcedOpen]);

  const active = Boolean(openSos) || forcedOpen;

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      void refreshSession();
    }, 2000);
    return () => window.clearInterval(timer);
  }, [active, refreshSession]);

  const notes = useMemo(() => {
    return notifications.filter((row) => {
      if (!isCommandNoteNotification(row)) return false;
      if (!openSos) return true;
      return row.incident_id === openSos.id || row.incident_id === null;
    });
  }, [notifications, openSos]);

  if (onlyWhenOpen && !active) return null;
  if (!active && notes.length === 0) return null;

  return (
    <section
      className={className}
      aria-live="polite"
      aria-label="Messages from control room"
      data-testid="sos-reply-thread"
    >
      <p className="text-xs font-medium tracking-[0.2em] text-emerald-300/80 uppercase">
        Control room
      </p>
      {openSos ? (
        <p className="mt-1 text-sm text-muted-foreground">
          SOS is {openSos.status.replaceAll("_", " ")}. Officers can send text and voice notes here.
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">
          Replies from officers appear here.
        </p>
      )}
      {openSos ? (
        <div className="mt-3">
          <IncidentMessageThread incidentId={openSos.id} senderKind="tourist" />
        </div>
      ) : notes.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-border/80 bg-card/70 p-4 text-sm text-muted-foreground">
          Waiting for a note from the control room…
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {notes.map((note) => (
            <li
              key={String(note.id)}
              className="rounded-2xl border border-emerald-700/40 bg-emerald-950/30 p-4"
            >
              <p className="text-sm font-medium">{note.title ?? "Control room"}</p>
              {note.body ? <p className="mt-1 text-sm text-pretty">{note.body}</p> : null}
              <p className="mt-2 text-xs text-muted-foreground">
                {new Date(note.created_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
