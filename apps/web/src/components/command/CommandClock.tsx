"use client";

import { useEffect, useState } from "react";

export function CommandClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!now) {
    return (
      <span className="hidden font-mono text-[11px] tabular-nums text-muted-foreground lg:inline">
        IST
      </span>
    );
  }

  return (
    <time
      dateTime={now.toISOString()}
          className="hidden font-mono text-[11px] tabular-nums text-muted-foreground lg:inline"
    >
      {now.toLocaleString("en-IN", {
        hour12: false,
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })}{" "}
      IST
    </time>
  );
}
