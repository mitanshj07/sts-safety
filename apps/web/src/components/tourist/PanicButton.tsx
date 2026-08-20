// apps/web/src/components/tourist/PanicButton.tsx
"use client";

import { useCallback, useRef, useState, type PointerEvent } from "react";
import { SOS_MESSAGE_MAX_LENGTH } from "@sts/shared";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { pointEwkt, roundCoord } from "@/lib/geo/ewkt";
import { persistPing } from "@/lib/offline/ping-queue";
import { postIncidentMessage } from "@/lib/incidents/messages-client";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { useTouristRuntime } from "@/components/tourist/TouristProvider";
import { formatCoord, shortIncidentId } from "@/lib/ui/format";
import { cn } from "@/lib/utils";

const HOLD_MS = 1500;
const CIRC = 2 * Math.PI * 46;

type SosState = "idle" | "holding" | "sending" | "sent" | "sms";

export function PanicButton({ className }: { className?: string }) {
  const { tourist, lastFix, markSos } = useTouristRuntime();
  const [state, setState] = useState<SosState>("idle");
  const [fill, setFill] = useState(0);
  const [note, setNote] = useState("");
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const raf = useRef<number | null>(null);
  const start = useRef(0);
  const [smsHref, setSmsHref] = useState<string | null>(null);

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
    const touristMessage = note.trim().slice(0, SOS_MESSAGE_MAX_LENGTH);
    const smsLines = [
      `SOS Smart Tourist Safety. I need help. Coords ${roundCoord(lat)},${roundCoord(lon)} at ${new Date().toISOString()}`,
    ];
    if (touristMessage) smsLines.push(touristMessage);
    const body = encodeURIComponent(smsLines.join(" "));
    setSmsHref(smsNumber ? `sms:${smsNumber}?body=${body}` : `sms:?body=${body}`);

    if (lastFix && touristId) {
      await persistPing(touristId, lastFix, "manual");
    }

    const supabase = getBrowserSupabase();
    if (supabase) {
      let resolvedId: string | null = null;
      let retriggered = false;

      const { data: raised, error: rpcError } = await supabase.rpc("raise_sos", {
        p_lon: lastFix ? roundCoord(lastFix.lon) : null,
        p_lat: lastFix ? roundCoord(lastFix.lat) : null,
        p_accuracy_m: lastFix?.accuracy_m ?? null,
        p_message: touristMessage || null,
      });
      if (!rpcError && raised != null) {
        try {
          const rec =
            typeof raised === "string"
              ? (JSON.parse(raised) as { id?: unknown; retriggered?: unknown })
              : (raised as { id?: unknown; retriggered?: unknown });
          if (typeof rec.id === "string") resolvedId = rec.id;
          retriggered = rec.retriggered === true;
        } catch {
          resolvedId = null;
        }
      }

      if (!resolvedId && touristId) {
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
              ...(touristMessage ? { tourist_message: touristMessage } : {}),
            },
            occurred_at: new Date().toISOString(),
          })
          .select("id")
          .maybeSingle();
        const duplicate =
          Boolean(error) &&
          /incidents_open_dedupe|duplicate key/i.test(error?.message ?? "");
        retriggered = duplicate;
        resolvedId = data?.id ?? null;
        if (duplicate && !resolvedId) {
          const { data: existing } = await supabase
            .from("incidents")
            .select("id")
            .eq("tourist_id", touristId)
            .eq("type", "sos")
            .in("status", ["open", "acknowledged", "dispatched"])
            .limit(1)
            .maybeSingle();
          resolvedId = existing?.id ?? null;
        }
        if (error && !duplicate) {
          resolvedId = null;
        }
      }

      if (resolvedId) {
        setIncidentId(resolvedId);
        void fetch("/api/notify/mine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ incident_id: resolvedId }),
        });
        if (retriggered && touristMessage) {
          void postIncidentMessage({
            incidentId: resolvedId,
            kind: "text",
            body: touristMessage,
          });
        }
        setState("sent");
        return;
      }
    }
    setState("sms");
  }, [lastFix, markSos, note, tourist]);

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
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <div className="relative grid size-40 place-items-center">
        {state === "idle" ? (
          <span className="sos-ring pointer-events-none absolute inset-0 rounded-full border border-danger/40" />
        ) : null}
        <button
          type="button"
          aria-label="Hold for 1.5 seconds to send SOS"
          aria-describedby="sos-help"
          onPointerDown={onPointerDown}
          onPointerUp={stopHold}
          onPointerCancel={stopHold}
          disabled={state === "sending"}
          className={cn(
            "relative grid size-36 place-items-center rounded-full text-sm font-semibold tracking-[0.18em] text-white",
            "focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            state === "sent" ? "bg-success" : "bg-danger",
            "disabled:opacity-90",
          )}
        >
          <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90">
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="rgba(255,255,255,0.28)"
              strokeWidth="5"
            />
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="white"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={`${fill * CIRC} ${CIRC}`}
            />
          </svg>
          <span className="relative z-10 px-4 text-center">{label}</span>
        </button>
      </div>

      <div className="w-full max-w-xs space-y-1.5">
        <Label htmlFor="sos-optional-line" className="text-xs text-muted-foreground">
          Optional message
        </Label>
        <Input
          id="sos-optional-line"
          data-testid="sos-optional-line"
          value={note}
          onChange={(event) => setNote(event.target.value.slice(0, SOS_MESSAGE_MAX_LENGTH))}
          placeholder="Where you are, or what happened"
          maxLength={SOS_MESSAGE_MAX_LENGTH}
          disabled={state === "sending"}
        />
      </div>

      {state === "sending" ? (
        <p id="sos-help" className="max-w-xs text-center text-sm text-foreground" role="status">
          Sending emergency alert…
        </p>
      ) : state === "sent" ? (
        <div id="sos-help" className="max-w-sm space-y-1 text-center" role="status">
          <p className="text-sm font-semibold tracking-tight">SOS sent</p>
          <p className="text-sm text-muted-foreground">
            Responder network notified. Location shared.
          </p>
          {incidentId ? (
            <p className="sts-meta text-foreground">Incident {shortIncidentId(incidentId)}</p>
          ) : null}
          {lastFix ? (
            <p className="sts-meta">{formatCoord(lastFix.lat, lastFix.lon)}</p>
          ) : null}
        </div>
      ) : state === "sms" && smsHref ? (
        <div id="sos-help" className="max-w-sm space-y-2 text-center">
          <p className="text-sm font-semibold">Location update paused on the network</p>
          <p className="text-sm text-muted-foreground">
            We could not write the incident. Your last known location is still on this device.
            Open SMS to alert a contact.
          </p>
          <a
            href={smsHref}
            className="inline-flex min-h-11 items-center text-sm font-medium text-danger underline underline-offset-4"
          >
            Open SMS with coordinates
          </a>
        </div>
      ) : (
        <p id="sos-help" className="max-w-xs text-center text-sm text-muted-foreground">
          Hold for 1.5 seconds to alert responders. Release to cancel.
        </p>
      )}
    </div>
  );
}
