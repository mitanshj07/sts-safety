# 6-minute stage runbook

**Roles:** Speaker (you), Clicker (teammate on the command laptop), Phone (teammate with the tourist PWA, already installed).

**Before the slot:** `pnpm demo:reset`. Dashboard open at `/dashboard` signed in as `admin@demo.sts`. Phone signed in as Priya Sharma, GPS on, `/home` visible. Simulator terminal ready but **not** running.

Measured SOS figure to quote: **Realtime first-channel typically 180–450 ms** on the local stack (`notify.sos_to_telegram_ms` / `first_channel_ms` in the server log). Online Telegram target is **under 2 seconds**.

---

## 0:00–0:20 — Hook

**Say:** “This is a safety system for tourists in the North-East. Geo-fencing lives in Postgres, not in the app. Blockchain and AI sit beside that path — if they die, the alert still fires.”

**Clicker:** Do nothing. Dashboard is idle, KPI strip at zeros.

## 0:20–1:10 — Digital ID (issue)

**Phone:** `/login?tab=tourist` → **Continue with DigiLocker** → sign in on DigiLocker (MeitY) → allow access → onboarding opens with eAadhaar / name / DOB from the issued XML. Seeded **Enter as Priya Sharma** skips this and lands on `/home`. Manual Aadhaar is the backup if DigiLocker is denied. Local rehearsals with `DIGILOCKER_MODE=demo` still use the in-app Allow screen (Priya Sharma `2341 2341 2346`).

**Say while the transaction confirms:** “KYC is encrypted in Postgres with pgcrypto. The chain only stores a keccak256 commitment and a soulbound token — no name, no passport, no GPS. If Amoy is slow we are on Anvil; the card is valid offline either way.”

**Clicker:** `/verify` ready. When the token appears, paste it (or scan the QR). Green “Valid” or “Chain offline + DB mirror” both count.

**Recovery if mint reverts:** Stay on the ID card. “The mirror in Postgres is the operational record. The chain is an integrity proof, not the login.”

## 1:10–2:20 — Live map + geo-fence

**Clicker:** Back to `/dashboard`. Map should show NE envelope + seeded zones.

**Say:** “Containment is `ST_Covers` inside an `AFTER INSERT` trigger. The phone can warn locally with Turf.js, but the incident is created by PostGIS so a buggy client cannot skip it.”

**Clicker (terminal):**

```bash
pnpm sim -- --scenario zone-breach --tourists 8 --speed 8x --duration 75s
```

Kenji Nakamura walks into Kaziranga core ~45 s of sim-time (a few wall-clock seconds at 8×).

**Say when the pin goes red:** “Restricted forest. Critical, not colour-only — you can hear the chime and the queue says CRITICAL.”

**Clicker:** Arrow-key the queue, Enter to open the drawer, **Acknowledge**.

## 2:20–3:20 — SOS

**Phone:** `/sos`, hold the button 1.5 s.

**Say:** “That insert is RLS-authenticated into `incidents`. Telegram, web-push, email fan out in parallel after the row exists. If the WAN is dead, Realtime still paints this screen.”

**Clicker:** Critical SOS appears; ARIA live region announces it. Dispatch panel lists nearest on-duty units.

**Recovery if SOS says SMS fallback:** “The device queued the ping and opened SMS with coordinates — the last mile when the tower is gone.”

## 3:20–4:20 — AI beside the path

**Clicker:** Open the incident → **Generate E-FIR** or wait for the brief.

**Say:** “IsolationForest scores the last hour of pings. Groq writes the brief; Gemini is the fallback; ONNX then rules if both are down. The alert already fired before any of that.”

If `AI_MODE=onnx-local`: “This brief is the rules template. Same facts the LLM would see.”

## 4:20–5:10 — Cost, DPDP, connectivity

**Say (no clicking):**

- “10,000 tourists is still free-tier Postgres if we downsample pings after 24 h — we already cron that.”
- “DPDP: consent at the primer, purpose limitation, no PII on-chain, RLS, encryption at rest for KYC.”
- “Arunachal GPS: the PWA queues pings in IndexedDB and flushes on reconnect. Geofence warnings run on-device.”

## 5:10–6:00 — Close + Q&A bait

**Clicker:** `/analytics` for 5 seconds, then back to the live queue.

**Say:** “Soulbound ID for integrity, PostGIS for safety, AI for triage. Unplug us and the alert still fires. Questions?”

---

## Top 5 failure modes and the designated recovery

| # | Failure | What you see | Recovery (do this, then keep talking) |
| --- | --- | --- | --- |
| 1 | Venue Wi-Fi dies | Map gray / Amoy stalls | Already on local modes if you rehearsed. If not: `CHAIN_MODE=disabled` is unnecessary — Anvil is local. Refresh `/dashboard`. Incidents already in DB appear. |
| 2 | Amoy RPC / faucet empty | Issue hangs on “queued” | Show the ID card + “valid offline”. Verify uses the DB mirror (`source: offline`). |
| 3 | Simulator does not breach | No Kaziranga incident | Phone: open `/map` standing still is useless — Clicker runs `pnpm sim -- --scenario panic-sos --duration 30s` **or** Phone holds SOS. Same queue. |
| 4 | Telegram silent | No phone buzz in the group | Point at the dashboard live region. “Telegram is a fan-out channel, not the source of truth.” |
| 5 | Demo leftovers from last slot | Stale incidents | `pnpm demo:reset` (under 10 s). Do not `supabase db reset` on stage. |

Hard abort: if Next.js itself is down, open Studio at `http://127.0.0.1:54323`, table `incidents`. “The engine is the database.”
