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
          background: "#0f1a24",
          color: "#f3efe4",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <main style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <p style={{ letterSpacing: "0.14em", fontSize: 11, opacity: 0.65, textTransform: "uppercase" }}>
            MDoNER · control room
          </p>
          <h1 style={{ fontSize: 32, margin: "10px 0 12px", fontWeight: 500 }}>Something broke</h1>
          <p style={{ opacity: 0.8, fontSize: 14, lineHeight: 1.5 }}>
            The safety path is still in Postgres. Refresh and continue the demo.
            {error.digest ? ` Digest ${error.digest}.` : ""}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 16,
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid #3a4554",
              background: "#c9a227",
              color: "#1c1608",
              fontWeight: 600,
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
