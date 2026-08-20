export function formatCoord(lat: number, lon: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(5)}°${ns}  ${Math.abs(lon).toFixed(5)}°${ew}`;
}

export function formatIst(
  iso: string | Date,
  opts: Intl.DateTimeFormatOptions = {},
): string {
  const date = iso instanceof Date ? iso : new Date(iso);
  return date.toLocaleString("en-IN", {
    hour12: false,
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    ...opts,
  });
}

export function formatIstTime(iso: string | Date): string {
  return formatIst(iso, { day: undefined, month: undefined, second: "2-digit" });
}

export function shortIncidentId(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export function formatIstDate(iso: string | Date): string {
  const date = iso instanceof Date ? iso : new Date(iso);
  return date.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function relativeTime(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime();
  const sec = Math.max(0, Math.round(delta / 1000));
  if (sec < 45) return "just now";
  if (sec < 90) return "1 min ago";
  if (sec < 3600) return `${Math.round(sec / 60)} min ago`;
  if (sec < 5400) return "1 hr ago";
  if (sec < 86400) return `${Math.round(sec / 3600)} hr ago`;
  return formatIstDate(iso);
}

