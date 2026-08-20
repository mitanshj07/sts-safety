// apps/web/src/hooks/usePushSubscription.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { publicEnv } from "@/lib/config/public";
import { urlBase64ToUint8Array } from "@/lib/notify/vapid";

export type PushState = "idle" | "unsupported" | "denied" | "subscribed" | "error";

export function usePushSubscription(enabled: boolean): {
  state: PushState;
  subscribe: () => Promise<void>;
} {
  const [state, setState] = useState<PushState>("idle");

  const subscribe = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    const vapid = publicEnv.vapidPublicKey;
    if (!vapid) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    try {
      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
        });
      }
      const json = sub.toJSON();
      const endpoint = json.endpoint;
      const p256dh = json.keys?.p256dh;
      const auth = json.keys?.auth;
      if (!endpoint || !p256dh || !auth) {
        setState("error");
        return;
      }
      await fetch("/api/notify/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint,
          keys: { p256dh, auth },
          user_agent: navigator.userAgent,
        }),
      });
      setState("subscribed");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const frame = window.requestAnimationFrame(() => {
      void subscribe();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [enabled, subscribe]);

  return { state, subscribe };
}
