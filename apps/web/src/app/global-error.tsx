// apps/web/src/app/global-error.tsx
"use client";

import { useEffect } from "react";

import { captureException } from "@/lib/observability/sentry";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureException(error, { boundary: "global" });
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0f172a",
          color: "#e2e8f0",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <main style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <p style={{ letterSpacing: "0.2em", fontSize: 12, opacity: 0.7 }}>
            MDoNER · CONTROL ROOM
          </p>
          <h1 style={{ fontSize: 28, margin: "8px 0 12px" }}>Something broke</h1>
          <p style={{ opacity: 0.8, fontSize: 14 }}>
            The safety path is still in Postgres. Refresh and continue the demo.
            {error.digest ? ` Digest ${error.digest}.` : ""}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 16,
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid #334155",
              background: "#14532d",
              color: "white",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
