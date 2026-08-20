"use client";

import { useEffect, useState } from "react";

export function CommandClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    const frame = window.requestAnimationFrame(tick);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(id);
    };
  }, []);

  if (!now) {
    return (
      <span className="hidden font-mono text-[11px] tabular-nums text-muted-foreground xl:inline">
        IST
      </span>
    );
  }

  return (
    <time
      dateTime={now.toISOString()}
      className="hidden font-mono text-[11px] tabular-nums text-muted-foreground xl:inline"
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
