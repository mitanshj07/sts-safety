# 1. Proposed 100% Free-Tier Tech Stack

**Project:** Smart Tourist Safety Monitoring & Incident Response System
**PS:** SIH 2025 — Ministry of Development of North Eastern Region (MDoNER), Cybersecurity PS-04 / Travel & Tourism PS-01

## 1.0 Selection rules applied

Every component below satisfies all four constraints:

1. **No credit card** required at signup.
2. **No trial clock** — the free tier is perpetual, not a 14/30-day evaluation.
3. **No hard paywall at demo scale** — comfortably serves ~50 simulated tourists, ~5 Hz aggregate ping rate, ~3 hour judging window.
4. **Deterministic on demo day** — every external dependency has a documented offline/local fallback, because the single biggest failure mode at SIH is "the free API rate-limited us during the pitch."

Anything that failed a rule (Twilio SMS, Mapbox, Firebase Blaze, AWS, Alchemy paid RPC, Pinata paid IPFS) is listed in §1.9 with the reason and the replacement.

---

## 1.1 Frontend — Tourist app + Admin dashboard

| Concern | Choice | Why this, not the obvious alternative |
| --- | --- | --- |
| App framework | **Next.js 16 (App Router) + TypeScript**, one codebase, two route groups: `(tourist)` and `(command)` | Server Components let the admin dashboard query PostGIS server-side with zero client bundle cost. One deploy, one domain, one auth session — critical when you have 36 hours. |
| Tourist client form factor | **Installable PWA** (Web App Manifest + Service Worker), *not* React Native | An APK needs Expo EAS builds (free tier is metered) and judges must sideload it. A PWA is a URL: a judge scans a QR, taps "Add to Home Screen," and grants geolocation in 5 seconds. It also gets you Web Push and background sync for free. |
| Styling / components | **Tailwind CSS v4 + shadcn/ui** | Free, source-in-repo (no runtime dependency), and gives a command-centre look without a designer. |
| Map rendering | **MapLibre GL JS v5** | Genuinely open source, no API key, no token, no usage ceiling. Mapbox GL JS v2+ is proprietary-licensed and metered. |
| Basemap tiles | **OpenFreeMap** (`https://tiles.openfreemap.org/styles/liberty`) — no key, no rate limit, donation-funded | MapTiler/Stadia free tiers need a key and cap at 100k tiles/mo with domain locking. Keep **Protomaps** as fallback #1 and a **self-hosted PMTiles extract of the North East** (~80 MB, committed to the repo / Supabase Storage) as fallback #2 for the offline demo. |
| Geofence drawing (admin) | **Mapbox GL Draw** fork `@mapbox/mapbox-gl-draw` + `maplibre-gl-draw-adapter`, or **Terra Draw** | Terra Draw is MIT, MapLibre-native, and lets an admin draw a polygon zone directly on the map that serializes to GeoJSON → PostGIS. |
| Client-side geometry | **Turf.js** (`@turf/boolean-point-in-polygon`, `@turf/distance`) | Lets the phone pre-evaluate geofence breach *locally* so an alert fires even with a flaky network, then reconciles with the server. Big credibility win with judges. |
| Charts | **Recharts** | Free, React-native-to-the-DOM, enough for incident-rate and safety-score panels. |
| i18n | **next-intl** + JSON catalogues (en, hi, as, bn, ne) | PS explicitly mentions multilingual support for NE tourists. Strings are static; LLM handles dynamic alert translation (§1.6). |

**Geocoding / reverse geocoding:** **Photon** (Komoot, free, no key, `photon.komoot.io`) primary; **Nominatim** (OSM) secondary with the 1 req/s policy respected via a server-side queue. Never call these from the browser.

**Routing (nearest-responder ETA):** **OSRM public demo server** or **OpenRouteService** free key (2,000 req/day, no card). Fallback: straight-line Haversine × 1.4 road-factor.

---

## 1.2 Backend & APIs

| Concern | Choice | Notes |
| --- | --- | --- |
| Primary API | **Next.js Route Handlers on Vercel Hobby** | Free forever, no card. Runs on Fluid Compute (Node.js 24, 300 s default timeout) — you do **not** need `runtime = 'edge'`, and you should not use it: you need the full Node API surface for `viem` signing and `web-push`. |
| Hot path (location ingest) | **Supabase `postgrest` insert direct from client**, guarded by RLS | Skips a serverless hop entirely for the highest-volume endpoint. 50 devices × 1 ping / 5 s = 10 writes/s, which Postgres handles trivially and Vercel Hobby's invocation budget would not love. |
| Heavy/privileged path | Next.js Route Handlers (`/api/*`) | Blockchain issuance, DigiLocker OAuth + eAadhaar fetch, alert dispatch, E-FIR drafting, admin mutations. Uses the Supabase **service role** key, never exposed to the browser. |
| Indian KYC fetch | **DigiLocker requester API** (MeitY, free) at `digilocker.meripehchaan.gov.in` | Production is **live**: OAuth + PKCE, then eAadhaar XML and issued documents. In-app demo consent is only when `DIGILOCKER_MODE=demo`. Partner registration at partners.digitallocker.gov.in. Typed Aadhaar / Voter ID / DL remains the offline fallback. |
| ML microservice | **FastAPI on Hugging Face Spaces (free CPU Basic: 2 vCPU / 16 GB)** | HF Spaces needs no card and never expires; it sleeps after 48 h idle, which a keep-alive cron solves. This is where scikit-learn / IsolationForest lives. |
| Scheduled jobs | **Supabase `pg_cron` + `pg_net`** (in-database, free) as primary; **GitHub Actions `schedule`** (free on public repos) as the external heartbeat | Vercel Hobby crons are limited to 2 jobs at daily granularity — not enough. `pg_cron` runs the stale-ping sweeper every minute inside Postgres, which is exactly where the data already is. |
| Validation & types | **Zod v4** + shared `packages/shared` | One schema definition drives API validation, DB row types, and form validation. |
| API style | REST + Server Actions for admin mutations; **no GraphQL** | GraphQL is a hackathon time sink here. |

---

## 1.3 Spatial database & geofencing engine

**Choice: Supabase Free Tier — Postgres 15 + PostGIS 3.**

This is the single most important pick in the stack, and it is not close.

| Capability needed | How Supabase free tier delivers it |
| --- | --- |
| Geofence containment | Native **PostGIS** `ST_Contains` / `ST_Intersects` on `geography(Polygon,4326)` with a **GiST index**. Sub-millisecond for hundreds of zones. |
| "Who is near this incident?" | `ST_DWithin(location, incident_point, 2000)` — indexed radius search for responder dispatch. |
| Route-deviation detection | `ST_Distance` from the tourist's planned itinerary `LineString`, plus `ST_FrechetDistance` for whole-trajectory similarity. |
| Real-time push to dashboard | **Supabase Realtime** — Postgres logical replication streamed to WebSocket subscribers. Zero servers to run. Free tier: 200 concurrent connections, 2 M messages/month. |
| Auth | **Supabase Auth** — email magic link + anonymous sessions for demo tourists. Phone OTP is avoided because it needs a paid SMS provider. |
| File storage | **Supabase Storage** 1 GB — PMTiles offline basemap, tourist photos, generated E-FIR PDFs. |
| Row-level security | **RLS policies** so a tourist can read only their own pings and a responder only their jurisdiction's incidents. Judges *will* ask about data privacy under the DPDP Act 2023. |

**Free-tier limits and the mitigation:** 500 MB database, 5 GB egress, 2 active projects, and **the project pauses after 7 days of inactivity**. Mitigations, all implemented in the repo:
- A `location_pings` retention policy (`pg_cron` deletes pings older than 24 h into a downsampled `location_tracks` LineString) keeps the DB well under 500 MB.
- A GitHub Actions workflow pings `/api/health` every 6 hours so the project never pauses before demo day.
- `docker compose up` runs the **entire Supabase stack locally** from the same migrations — your offline fallback is a single command.

**The geofencing engine itself is a Postgres function, not application code.** `evaluate_position(tourist_id, lat, lon)` is a `plpgsql` function invoked by an `AFTER INSERT` trigger on `location_pings`. It resolves zone membership, computes dwell time, raises the appropriate incident row, and Realtime broadcasts it. Doing this in the database rather than in Node means the geofence cannot be bypassed by a buggy client and there is no race between ingest and evaluation.

---

## 1.4 Blockchain / smart contracts — Tourist Digital ID

**Network: Polygon Amoy testnet (chain ID 80002).** Free POL from faucets, EVM-standard, sub-second finality, and the "Polygon" name lands well with a government jury given the ecosystem's India presence.

| Concern | Choice | Justification |
| --- | --- | --- |
| Chain | **Polygon Amoy** (80002) | Testnet POL is free. ~2 s blocks. Amoy replaced Mumbai in 2024 — do not use Mumbai, it is decommissioned. |
| RPC | **Public, keyless RPCs with client-side failover**: `https://rpc-amoy.polygon.technology`, `https://polygon-amoy-bor-rpc.publicnode.com`, `https://rpc.ankr.com/polygon_amoy` | Keyless means no signup, no card, and no key to leak in a public SIH repo. `viem`'s `fallback([...])` transport rotates automatically on failure. |
| Faucet | `faucet.polygon.technology` (Discord auth), Chainlink faucet, QuickNode faucet | Fund the relayer wallet **the week before**, not on demo day. 1 POL mints thousands of IDs. |
| Toolchain | **Foundry** (`forge`, `anvil`, `cast`) | Free, fast, Solidity-native tests, and `anvil` is your deterministic offline demo chain. Hardhat is fine but slower to iterate. |
| Client library | **viem v2** | Typed, tree-shakeable, first-class `fallback` transport, works in Route Handlers. |
| Contract verification | **Polygonscan Amoy** free API key (no card) | A verified contract with a public read tab is a 30-second credibility proof during Q&A. |
| Off-chain metadata | **Supabase Storage** with a content-addressed key (`sha256`), *not* IPFS | Free IPFS pinning tiers (Pinata/web3.storage) now require accounts with limits and are slow to resolve during a live demo. The on-chain hash is what provides tamper-evidence; where the blob is hosted is an implementation detail you can defend. Optional: also pin to IPFS via a public gateway as a nice-to-have. |

### Answering the "is your blockchain superficial?" question

This is the risk you flagged, and it is the question that kills teams on this PS. The architecture is designed so the answer is concrete:

1. **No PII ever touches the chain.** The contract stores `kycCommitment = keccak256(idType ‖ idNumber ‖ salt)` where `salt` is a per-tourist random value held encrypted in Postgres. This is a *commitment*, not a lookup key — the chain is unlinkable without the salt, which is what makes it lawful under the **DPDP Act 2023** (personal data minimisation) and under GDPR for foreign tourists. A design that put Aadhaar/passport numbers on a public chain would be illegal, and saying so out loud demonstrates you understood the problem.
2. **The credential is soulbound.** The ID is an **ERC-721 implementing ERC-5192 (`locked() == true`)** — non-transferable by construction. A transferable tourist ID would be a security hole; the standard exists precisely for this.
3. **Blockchain solves a real multi-party trust problem here, not a database problem.** The issuing authority (a state tourism department at a check-post), the verifying party (a hotel, a police checkpoint in a different state, a forest permit office), and the auditing party (MDoNER) are *different organisations with no shared database*. The chain gives them a common revocation registry and an append-only issuance log that no single department can retroactively edit. That is the classic, defensible use case.
4. **Incidents are anchored too.** `IncidentAnchor.sol` stores `keccak256` of the incident record + a monotonic counter, so the chain of custody for an E-FIR is provably un-backdated. This is the difference between "we minted an NFT" and "we built an evidentiary audit trail."
5. **Tourists never need a wallet.** The backend runs a **custodial HD-derived signer** (BIP-44 path `m/44'/60'/0'/0/{tourist_index}` from one mnemonic) and a **gas relayer** funded with testnet POL. The tourist experience is: enter Aadhaar (Indian) or passport (international) → get a QR. Zero Web3 friction. Note in your pitch that production would migrate to ERC-4337 account abstraction with a paymaster.
6. **Validity is enforced on-chain.** `validFrom` / `validUntil` mean an expired visa or a completed trip auto-invalidates the credential without any off-chain job. `verify(tokenId)` is a single free `eth_call`.

---

## 1.5 AI / ML — anomaly detection & safety scoring

The correct answer here is **not "call an LLM on GPS coordinates."** Judges spot that immediately. Use a three-tier model where each tier does what it is actually good at.

### Tier 1 — Deterministic rules (in Postgres, sub-ms, always runs)
Encoded as SQL in `evaluate_position()`. Fires on: entry into a `restricted` or `high_risk` zone, exit from the itinerary corridor, ping silence > N minutes, implausible speed (> 150 km/h ⇒ device spoofing or vehicle), sustained zero-movement in a non-accommodation zone, entry into a zone outside its permitted time window (e.g. forest reserve after sunset). These are auditable and explainable, which matters for a government system.

### Tier 2 — Unsupervised anomaly model (Python, on Hugging Face Spaces)
- **Model:** `IsolationForest` (scikit-learn) on a windowed feature vector — speed mean/σ, bearing entropy, stop count, stop duration, distance-from-itinerary, radius of gyration, night-fraction, zone-risk-weighted dwell.
- **Backup model:** `DBSCAN` for stop-point clustering to distinguish "resting at a hotel" (benign) from "stationary on a highway at 2 a.m." (anomalous).
- **Training data:** a **synthetic trajectory generator** (`tools/simulator`) producing labelled normal and abnormal tracks over real Guwahati/Shillong/Tawang road geometry pulled from OSM. Be explicit in the pitch that this is synthetic — every team on this PS has synthetic data, and the ones who pretend otherwise get caught.
- **Deployment:** train offline, export to **ONNX**, and serve two ways — FastAPI on HF Spaces for the full pipeline, and `onnxruntime-node` inside a Vercel Route Handler as the zero-dependency fallback so the demo survives an HF cold start.

### Tier 3 — LLM reasoning layer (free inference APIs, never on the hot path)
- **Providers:** **Groq** (Llama 3.3 70B / `openai-oss`, generous free RPM, no card) as primary; **Google AI Studio Gemini 2.5 Flash** free tier as fallback. Wired through the **Vercel AI SDK v6** so swapping providers is a one-line change.
- **Jobs it does:** (a) turn a raw incident row into a 2-sentence human brief for the control room, (b) draft the **E-FIR** narrative for a missing-person report from the structured incident record, (c) translate alerts into the tourist's language, (d) a natural-language query bar over the incident table ("show me all high-severity alerts in Kaziranga in the last 6 hours") compiled to safe parameterised SQL.
- **Guardrail:** the LLM never *decides* whether to raise an alert. It only explains and formats decisions made by Tiers 1 and 2. State this explicitly — "we don't let a stochastic model gate emergency response" is a strong answer.

**Composite Safety Score (0–100)** shown on the tourist app and the dashboard is a transparent weighted blend: itinerary adherence, zone risk exposure, time-of-day, ping health, historical incident density of the current cell (H3 index), and the Tier-2 anomaly score. Transparent because the tourist is shown *why* their score dropped.

---

## 1.6 Real-time alerts & notification dispatch

Multi-channel, because a single free channel is a single point of failure on stage.

| Channel | Tech | Cost | Used for |
| --- | --- | --- | --- |
| Dashboard live feed | **Supabase Realtime** (Postgres CDC → WebSocket) | Free (200 conns, 2 M msg/mo) | Incidents, live tourist positions, responder status — the primary demo surface. |
| Tourist device push | **Web Push (VAPID)** via the `web-push` npm package + Service Worker | **Free, no vendor at all** — it's a W3C standard talking directly to Google/Mozilla/Apple push services | Geofence warnings, safety-score drops, check-in nudges. Works with the screen off. |
| Police / control-room | **Telegram Bot API** | Free, unlimited, instant | This is the SMS replacement. A `@NE_TouristSafety_Bot` posts formatted incident cards with a map thumbnail and inline "Acknowledge / Dispatch" buttons into a police control-room group. Demos *better* than SMS because the whole room can see it on a projector. |
| Email / E-FIR delivery | **Resend** free tier (3,000/mo, 100/day, no card) | Free | E-FIR PDF to the district police email, daily digest to tourism dept. |
| In-app SOS acknowledgement | Supabase Realtime broadcast channel | Free | Sub-second round trip from panic-button press to "Help is on the way, ETA 7 min." |
| SMS (optional, degraded) | Documented as **out of scope for the free prototype** with a one-file adapter interface (`INotificationChannel`) so a Twilio/MSG91 key drops in | — | Say this proactively: "SMS is a ₹0.12/message commercial dependency; our dispatcher is channel-agnostic and an SMS adapter is 40 lines." |

**Panic button path:** device → Supabase insert (`incidents`, type `sos`) → trigger → Realtime broadcast to dashboard **and** `pg_net` HTTP call to `/api/dispatch` → Telegram + Web Push + responder assignment. Measured end-to-end target: **< 2 seconds**.

---

## 1.7 Supporting free infrastructure

| Need | Choice | Free-tier note |
| --- | --- | --- |
| Hosting (web) | **Vercel Hobby** | No card. 100 GB bandwidth/mo. |
| Hosting (ML) | **Hugging Face Spaces**, CPU Basic | No card. Sleeps at 48 h idle. |
| DB / Realtime / Auth / Storage | **Supabase Free** | No card. 2 projects. |
| CI, cron heartbeat, contract deploy | **GitHub Actions** | Free/unlimited on public repos. |
| Error tracking | **Sentry Developer** free (5 k errors/mo) | No card. |
| Analytics | **Vercel Web Analytics** Hobby | Included. |
| Package manager / monorepo | **pnpm workspaces** | Local. |
| IoT wearable (optional stretch) | **ESP32 + simulated BLE beacon**, or pure software simulator | The PS mentions IoT bands; a `tools/simulator` device emulator posting to the same ingest endpoint is a legitimate, honest implementation. |
| Offline demo chain | **Anvil** (Foundry) | Local, instant, deterministic. |
| Offline demo DB | **Supabase CLI local stack** (Docker) | Same migrations, same code. |

---

## 1.8 The demo-day resilience plan (build this in from day one)

Every external service has a switch:

```
NEXT_PUBLIC_MAP_TILE_MODE = openfreemap | pmtiles-local
CHAIN_MODE               = amoy | anvil-local
AI_MODE                  = groq | gemini | onnx-local | rules-only
DB_MODE                  = supabase-cloud | supabase-local
NOTIFY_CHANNELS          = realtime,webpush,telegram,email
```

Rehearse the pitch once with every switch flipped to local. A team that can pull the ethernet cable and keep demoing wins the room.

---

## 1.9 Explicitly rejected, and why

| Rejected | Reason | Replaced by |
| --- | --- | --- |
| Twilio SMS | Trial requires card in India; trial numbers prefix messages | Telegram Bot + Web Push |
| Firebase / FCM | FCM itself is free, but Firestore + Functions push you to Blaze (card required) for outbound network | Supabase + Web Push (VAPID) |
| Mapbox | Proprietary licence on GL JS v2+, metered map loads, requires token | MapLibre + OpenFreeMap |
| Google Maps Platform | Requires billing account with card | MapLibre / Photon / OSRM |
| AWS / GCP / Azure | Card required, 12-month clock | Vercel + Supabase + HF Spaces |
| MongoDB Atlas | Free M0 exists, but no real spatial ops beyond `$geoWithin` — no `ST_FrechetDistance`, no GiST, no SQL triggers | Supabase PostGIS |
| Ethereum mainnet / any L1 mainnet | Real gas cost | Polygon Amoy testnet |
| Polygon Mumbai | Decommissioned 2024 | Polygon Amoy (80002) |
| Pinata / IPFS pinning | Free tiers now gated and slow to resolve live | Supabase Storage + on-chain content hash |
| OpenAI API | No perpetual free tier | Groq + Google AI Studio |
| Render / Fly.io / Railway | Card required or free tier removed | Hugging Face Spaces |
| React Native + EAS | Metered builds, sideloading friction for judges | Installable PWA |

---

## 1.10 One-line stack summary for the slide deck

> **Next.js 16 PWA + MapLibre** on **Vercel**, **Supabase Postgres/PostGIS** for the geofencing engine and realtime bus, a **soulbound ERC-721 Tourist DID on Polygon Amoy** with zero PII on-chain, a **three-tier AI pipeline** (SQL rules → ONNX IsolationForest → Groq LLM for narrative and E-FIR), and **multi-channel dispatch** over Web Push, Telegram, and Supabase Realtime. Total infrastructure cost: **₹0**.
