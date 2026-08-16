// apps/web/src/components/tourist/ServiceWorkerRegistrar.tsx
"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { scope: "/" });
  }, []);
  return null;
}
