/* apps/web/public/sw.js */
/* Smart Tourist Safety — tourist PWA service worker.
   Offline app shell, Web Push, Background Sync for the ping queue. */

const SHELL = "sts-shell-v1";
const PRECACHE = [
  "/",
  "/home",
  "/map",
  "/id",
  "/trip",
  "/alerts",
  "/onboard",
  "/sos",
          "/offline/northeast-outline.geojson",
          "/offline/zones.geojson",
          "/icons/icon-192.png",
          "/icons/icon-512.png",
  "/manifest.webmanifest",
  "/icons/icon.svg",
];

const PING_DB = "sts-tourist";
const PING_STORE = "ping-queue";
const SYNC_TAG = "sts-flush-pings";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      try {
        const fresh = await fetch(req);
        const copy = fresh.clone();
        const cache = await caches.open(SHELL);
        void cache.put(req, copy);
        return fresh;
      } catch {
        if (cached) return cached;
        if (req.mode === "navigate") {
          const home = await caches.match("/home");
          if (home) return home;
        }
        return new Response("Offline", { status: 503, statusText: "Offline" });
      }
    })(),
  );
});

self.addEventListener("push", (event) => {
  let payload = { title: "Safety alert", body: "Open the tourist app.", url: "/alerts" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(payload.title ?? "Safety alert", {
      body: payload.body ?? "",
      icon: "/icons/icon.svg",
      badge: "/icons/icon.svg",
      data: { url: payload.url ?? "/alerts" },
      actions: [
        { action: "open", title: "Open alert" },
        { action: "ack", title: "Acknowledge" },
      ],
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/alerts";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          void client.navigate?.(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});

self.addEventListener("sync", (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(flushQueue());
  }
});

function openPingDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PING_DB, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PING_STORE)) {
        db.createObjectStore(PING_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("kv")) {
        db.createObjectStore("kv");
      }
    };
  });
}

async function flushQueue() {
  const db = await openPingDb();
  const pings = await new Promise((resolve, reject) => {
    const tx = db.transaction(PING_STORE, "readonly");
    const req = tx.objectStore(PING_STORE).getAll();
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });

  for (const ping of pings) {
    if (!ping.supabase_url || !ping.supabase_anon_key || !ping.access_token) continue;
    const body = {
      tourist_id: ping.tourist_id,
      geog: `SRID=4326;POINT(${ping.lon} ${ping.lat})`,
      accuracy_m: ping.accuracy_m,
      altitude_m: ping.altitude_m,
      speed_mps: ping.speed_mps,
      heading_deg: ping.heading_deg,
      battery_pct: ping.battery_pct,
      source: ping.source ?? "phone",
      recorded_at: ping.recorded_at,
    };
    try {
      const res = await fetch(`${ping.supabase_url}/rest/v1/location_pings`, {
        method: "POST",
        headers: {
          apikey: ping.supabase_anon_key,
          Authorization: `Bearer ${ping.access_token}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(body),
      });
      if (res.ok || res.status === 409) {
        await new Promise((resolve, reject) => {
          const tx = db.transaction(PING_STORE, "readwrite");
          tx.objectStore(PING_STORE).delete(ping.id);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      }
    } catch {
      // Keep the row; the page will flush on reconnect.
    }
  }
}
