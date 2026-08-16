// apps/web/src/components/tourist/PanicButton.tsx
"use client";

import { useCallback, useRef, useState, type PointerEvent } from "react";
import { pointEwkt, roundCoord } from "@/lib/geo/ewkt";
import { persistPing } from "@/lib/offline/ping-queue";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { useTouristRuntime } from "@/components/tourist/TouristProvider";
import { cn } from "@/lib/utils";

const HOLD_MS = 1500;
const CIRC = 2 * Math.PI * 46;

type SosState = "idle" | "holding" | "sending" | "sent" | "sms";

export function PanicButton({ className }: { className?: string }) {
  const { tourist, lastFix, markSos } = useTouristRuntime();
  const [state, setState] = useState<SosState>("idle");
  const [fill, setFill] = useState(0);
  const raf = useRef<number | null>(null);
  const start = useRef(0);
  const smsHref = useRef<string | null>(null);

  const stopHold = useCallback(() => {
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
    if (state === "holding") {
      setState("idle");
      setFill(0);
    }
  }, [state]);

  const fire = useCallback(async () => {
    setState("sending");
    if (navigator.vibrate) navigator.vibrate([80, 40, 80, 40, 200]);
    markSos();

    const lat = lastFix?.lat ?? 0;
    const lon = lastFix?.lon ?? 0;
    const touristId = tourist?.id;
    const contacts = Array.isArray(tourist?.emergency_contacts)
      ? tourist.emergency_contacts
      : [];
    const first = contacts[0] as { phone_e164?: string } | undefined;
    const smsNumber = first?.phone_e164?.replace(/[^\d+]/g, "") ?? "";
    const body = encodeURIComponent(
      `SOS Smart Tourist Safety. I need help. Coords ${roundCoord(lat)},${roundCoord(lon)} at ${new Date().toISOString()}`,
    );
    smsHref.current = smsNumber ? `sms:${smsNumber}?body=${body}` : `sms:?body=${body}`;

    if (lastFix && touristId) {
      await persistPing(touristId, lastFix, "manual");
    }

    const supabase = getBrowserSupabase();
    if (supabase && touristId) {
      const { data, error } = await supabase
        .from("incidents")
        .insert({
          tourist_id: touristId,
          type: "sos",
          severity: "critical",
          detected_by: "device",
          status: "open",
          geog: lastFix ? pointEwkt(roundCoord(lastFix.lon), roundCoord(lastFix.lat)) : null,
          payload: {
            source: "panic_button",
            accuracy_m: lastFix?.accuracy_m ?? null,
          },
          occurred_at: new Date().toISOString(),
        })
        .select("id")
        .maybeSingle();
      const duplicate =
        Boolean(error) &&
        /incidents_open_dedupe|duplicate key/i.test(error?.message ?? "");
      let incidentId = data?.id ?? null;
      if (duplicate && !incidentId) {
        const { data: existing } = await supabase
          .from("incidents")
          .select("id")
          .eq("tourist_id", touristId)
          .eq("type", "sos")
          .in("status", ["open", "acknowledged", "dispatched"])
          .limit(1)
          .maybeSingle();
        incidentId = existing?.id ?? null;
      }
      if (!error || duplicate) {
        if (incidentId) {
          void fetch("/api/notify/mine", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ incident_id: incidentId }),
          });
        }
        setState("sent");
        return;
      }
    }
    setState("sms");
  }, [lastFix, markSos, tourist]);

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setState("holding");
    setFill(0);
    start.current = performance.now();
    if (navigator.vibrate) navigator.vibrate(40);
    const tick = (now: number) => {
      const t = Math.min(1, (now - start.current) / HOLD_MS);
      setFill(t);
      if (t >= 1) {
        void fire();
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };

  const label =
    state === "sending"
      ? "SENDING"
      : state === "sent"
        ? "SENT"
        : state === "sms"
          ? "SMS FALLBACK"
          : "HOLD FOR SOS";

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <button
        type="button"
        aria-label="Hold for 1.5 seconds to send SOS"
        onPointerDown={onPointerDown}
        onPointerUp={stopHold}
        onPointerCancel={stopHold}
        disabled={state === "sending" || state === "sent"}
        className={cn(
          "relative grid size-40 place-items-center rounded-full text-sm font-semibold tracking-widest text-white",
          state === "sent" ? "bg-emerald-700" : "bg-red-700 sos-glow",
          "disabled:opacity-80",
        )}
      >
        <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="6"
          />
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="white"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${fill * CIRC} ${CIRC}`}
          />
        </svg>
        <span className="relative z-10 px-4 text-center">{label}</span>
      </button>
      {state === "sms" && smsHref.current ? (
        <a
          href={smsHref.current}
          className="text-sm text-red-300 underline underline-offset-4"
        >
          Open SMS with coordinates
        </a>
      ) : (
        <p className="max-w-xs text-center text-xs text-muted-foreground">
          Hold 1.5s to confirm. Works offline — queued until the network returns, then SMS
          fallback if the insert fails.
        </p>
      )}
    </div>
  );
}
