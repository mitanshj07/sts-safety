// apps/web/src/components/shared/SentryInit.tsx
"use client";

import { useEffect } from "react";

import { captureException, sentryEnabled } from "@/lib/observability/sentry";

export function SentryInit(): null {
  useEffect(() => {
    if (!sentryEnabled()) return;

    const onError = (event: ErrorEvent): void => {
      captureException(event.error ?? event.message, { source: "window.onerror" });
    };
    const onRejection = (event: PromiseRejectionEvent): void => {
      captureException(event.reason, { source: "unhandledrejection" });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
