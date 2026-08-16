// apps/web/src/hooks/useOnlineStatus.ts
"use client";

import { useEffect, useState } from "react";

export function useOnlineStatus(): boolean {
  // Always start `true` so SSR and the first client paint match. Some runtimes
  // expose `navigator.onLine === false` during prerender, which hydrates as
  // "Offline" then flips to "Online".
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    setOnline(navigator.onLine);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return online;
}
