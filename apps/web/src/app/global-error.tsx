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
          background: "#F4F0E4",
          color: "#1A3A2A",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <main style={{ maxWidth: 420, padding: 24 }}>
          <p style={{ letterSpacing: "0.14em", fontSize: 11, textTransform: "uppercase", opacity: 0.7 }}>
            Recoverable error
          </p>
          <h1 style={{ fontSize: 24, margin: "8px 0 12px" }}>This screen failed to render</h1>
          <p style={{ opacity: 0.8, fontSize: 14, lineHeight: 1.5 }}>
            Alerts still fire in Postgres. Refresh and continue.
            {error.digest ? ` Digest ${error.digest}.` : ""}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 16,
              padding: "10px 16px",
              border: "1px solid #1A3A2A",
              background: "#1A3A2A",
              color: "#F4F0E4",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
