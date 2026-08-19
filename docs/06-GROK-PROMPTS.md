# 6. Grok 4.6 Build Sequence

Fourteen phases, each sized to fit comfortably in one context window. Feed them in order.

## How to use this file

1. **Start a fresh Grok chat for each phase.** Do not run Phase 9 in the same thread as Phase 2. Long threads degrade output quality and burn context on code Grok no longer needs.
2. **Paste the PRIMER (below) at the top of every new chat**, then the phase prompt underneath it. The primer is ~500 tokens and buys you consistency.
3. **Attach files rather than pasting them.** Where a phase says *"attach X"*, upload the actual file. Grok reads attachments more reliably than pasted walls of code, and it costs less context.
4. **Run the verification command at the end of each phase before moving on.** If it fails, use the repair prompt pattern in §Appendix A. Do not stack a broken phase under a new one.
5. **Commit after every phase.** `git commit -m "phase N: …"`. When Grok breaks something in Phase 8, you want a clean Phase 7 to return to.

---

## THE PRIMER — paste at the top of every phase

```
You are a senior full-stack engineer building a Smart India Hackathon 2025 project:
a Smart Tourist Safety Monitoring & Incident Response System for the Ministry of
Development of North Eastern Region (AI + Geo-Fencing + Blockchain Digital ID).

HARD CONSTRAINTS — never violate these:
- 100% free tier. No service that requires a credit card. If you are about to
  suggest Twilio, Mapbox, Google Maps, Firebase Blaze, AWS, or a paid LLM API,
  stop and use the approved stack instead.
- Approved stack, do not substitute:
  Next.js 16 (App Router, TypeScript, RSC) on Vercel Hobby
  Tailwind v4 + shadcn/ui
  MapLibre GL JS v5 + OpenFreeMap tiles (no API key) + Turf.js
  Supabase free tier: Postgres 15 + PostGIS 3 + Realtime + Auth + Storage
  Solidity 0.8.24 + Foundry + OpenZeppelin v5, Polygon Amoy (chainId 80002)
  viem v2 with fallback() transport across keyless public RPCs
  Python FastAPI + scikit-learn on Hugging Face Spaces (free CPU)
  Vercel AI SDK v6 with Groq primary and Google Gemini fallback
  Web Push (VAPID), Telegram Bot API, Resend — for notifications
  pnpm workspaces monorepo

ARCHITECTURE RULES:
- The geofencing engine lives in Postgres (PL/pgSQL + PostGIS triggers), not in
  application code.
- The blockchain and the AI are enhancements alongside the safety path, never
  inside it. An alert must still fire if the chain, the LLM, and the ML service
  are all down.
- No PII on chain, ever. Only keccak256 commitments.
- Row Level Security is enabled on every table.
- Every external dependency needs a local/offline fallback.

OUTPUT RULES:
- Full file contents with the exact path as a header comment. No "// ... rest of
  the file unchanged".
- TypeScript strict mode. No `any`. Zod for every external input.
- Do not invent env vars; use the ones in .env.example.
- If a requirement is ambiguous, pick the simplest option that demos well and
  state your assumption in one line at the end. Do not ask me questions mid-task.
```

---

# PHASE 0 — Repository scaffold

**Goal:** an installable, type-checking, empty monorepo.
**Attach:** `docs/03-REPO-STRUCTURE.md`, `.env.example`

```
Create the monorepo scaffold exactly matching the attached repo structure document.

Produce these files in full:
1. Root: package.json (pnpm workspaces; scripts: dev, build, typecheck, lint,
   db:reset, db:types, chain:build, chain:test, chain:deploy, sim, check:freetier),
   pnpm-workspace.yaml, turbo.json, .gitignore, .nvmrc (24), README.md skeleton.
2. packages/shared: package.json, tsconfig.json, src/index.ts, and empty but
   correctly-exported barrel files for schemas/, types/, constants/, utils/.
3. apps/web: Next.js 16 App Router with TypeScript strict, Tailwind v4,
   next.config.ts, tsconfig.json with @/* and @sts/shared path aliases,
   app/layout.tsx, app/page.tsx, app/globals.css, components.json for shadcn.
4. tools/simulator and services/ai: package.json / requirements.txt placeholders.
5. tools/scripts/check-freetier.sh: fails the build if any env var matching
   STRIPE|TWILIO|MAPBOX|AWS_|GOOGLE_MAPS is set.
6. docker-compose.yml running local Supabase and Anvil together.
7. .github/workflows/ci.yml: pnpm install, typecheck, lint, forge test.

Do not implement features. This phase only has to install and typecheck.
```

**Verify:** `pnpm install && pnpm typecheck` passes.

---

# PHASE 1 — Database schema

**Goal:** the geofencing engine, running locally.
**Attach:** `supabase/migrations/20250101000000_init.sql`, `docs/04-DATA-MODEL.md`

```
The attached SQL is the approved schema. Split it into the numbered migration
files listed below, fixing any syntax errors, missing casts, or ordering problems
you find as you go (PostGIS geography vs geometry casts are the usual culprits):

  20250101000000_extensions.sql
  20250101000100_enums.sql
  20250101000200_core_tables.sql
  20250101000300_spatial_tables.sql
  20250101000400_incident_tables.sql
  20250101000500_chain_tables.sql
  20250101000600_indexes.sql
  20250101000700_functions.sql
  20250101000800_triggers.sql
  20250101000900_rls.sql
  20250101001000_cron.sql
  20250101001100_views.sql

Then additionally produce:
1. supabase/config.toml for the local stack.
2. supabase/seed/01_zones_northeast.sql — at least 12 realistic zones with real
   coordinates across the North East: Kaziranga core (restricted), Kaziranga
   buffer (caution), Tawang town (safe), Bum La Pass approach (border,
   high_risk), Cherrapunji viewpoints (caution), Living Root Bridges trail
   (caution), Loktak Lake (safe), Dzukou Valley trek (high_risk),
   Guwahati city centre (safe), a night-restricted forest zone using
   time_windows, two hotel zones (accommodation), two checkpoint zones.
   Use ST_GeomFromGeoJSON with genuine polygon coordinates, not placeholders.
3. supabase/seed/02_responders.sql — 8 responders with real station coordinates
   across Assam, Meghalaya, Arunachal, Nagaland, Manipur.
4. supabase/seed/03_demo_tourists.sql — 5 tourists with itineraries as
   LineStrings following real roads (Guwahati→Shillong, Tezpur→Tawang).
5. A pgTAP-style test script supabase/tests/geofence.sql proving:
   inserting a ping inside a restricted zone creates exactly one incident;
   a second ping 30 s later creates zero additional incidents (dedupe works);
   a ping at 200 km/h raises implausible_speed.

Every migration must be idempotent-safe to re-run after `supabase db reset`.
```

**Verify:** `supabase db reset` completes; the seed loads; the geofence test passes.

---

# PHASE 2 — Shared types & Zod schemas

**Goal:** one source of truth for types across web, simulator, and tests.
**Attach:** the migration files from Phase 1

```
Build packages/shared completely:

1. src/types/database.ts — hand-write the Supabase Database type from the
   attached migrations (I will regenerate it later with `supabase gen types`,
   so match that generator's shape exactly: Database['public']['Tables'][...]
   with Row/Insert/Update).
2. src/schemas/*.ts — Zod v4 schemas for Tourist, LocationPing, Zone,
   Itinerary, Incident, Dispatch, IssueIdentityRequest, VerifyIdentityResponse,
   VerifiableCredential, NotificationPayload. Export inferred TS types alongside.
   Coordinates validated to lat ∈ [-90,90], lon ∈ [-180,180], rounded to 7dp.
3. src/constants/severity-matrix.ts — the same zone.risk × type × time-of-day
   matrix as the SQL derive_severity() function, so client and server agree.
4. src/constants/scoring-weights.ts — mirrors compute_safety_score().
5. src/constants/chains.ts — viem chain definitions for Polygon Amoy (80002)
   and local Anvil (31337), plus the ordered keyless RPC list.
6. src/utils/hash.ts — CRITICAL. Implement:
     canonicalJson(obj)  — keys sorted at every depth, no whitespace,
                           nulls omitted, timestamps as unix SECONDS,
                           coordinates rounded to 7 decimal places
     kycCommitment(kycType: number, kycNumber: string, salt: Hex)
        = keccak256(encodePacked(['uint8','string','bytes32'],
                                 [kycType, normalise(kycNumber), salt]))
        where normalise = uppercase + strip whitespace and hyphens
     incidentRecordHash(incident) — hashes ONLY the immutable core:
        id, tourist_token_id, type, severity, occurred_at, lat, lon,
        zone_id, detected_by, payload. Excludes status/ai_brief/timestamps.
     uuidToBytes16(uuid)
7. src/utils/geo.ts — haversine, bbox, geojson↔WKT, bearing.
8. Vitest tests for hash.ts with fixed vectors, including a canonicalJson test
   that proves key order in the input does not change the output.

Zero runtime dependencies except viem and zod.
```

**Verify:** `pnpm --filter @sts/shared test` passes.

---

# PHASE 3 — Smart contracts

**Goal:** deployed, verified contracts on Amoy.
**Attach:** all three files from `packages/contracts/src/`

```
Complete the Foundry package using the attached contracts as the specification.

1. foundry.toml (solc 0.8.24, optimizer 200 runs, Amoy rpc_endpoints and
   etherscan config for Polygonscan verification), remappings.txt.
2. Review the attached TouristIdentityRegistry.sol and IncidentAnchor.sol for
   correctness against OpenZeppelin v5 (note: v5 uses _update(), not
   _beforeTokenTransfer). Fix any compile errors. Keep every design invariant
   in the interface comments.
3. test/TouristIdentityRegistry.t.sol — implement all ten required tests listed
   in docs/04-DATA-MODEL.md §4.4, including vm.warp expiry tests and the
   AccessControl revert tests.
4. test/Invariants.t.sol — stateful fuzz proving no sequence of calls ever moves
   a token between two non-zero addresses.
5. test/IncidentAnchor.t.sol — append-only behaviour, verifyIntegrity true and
   false paths, batch anchoring.
6. script/Deploy.s.sol — deploys both, grants ISSUER_ROLE and ANCHOR_ROLE to the
   relayer address from env, writes deployments/{network}.json.
7. script/SeedDemo.s.sol — issues 3 demo identities so the verified contract has
   readable state on Polygonscan before the pitch.
8. .github/workflows/contracts-deploy.yml — workflow_dispatch → forge script
   --broadcast --verify against Amoy.
9. tools/scripts/copy-abi.sh — copies the two ABIs from out/ into
   apps/web/src/lib/chain/abi/ as .ts files exporting `as const` arrays.

Report the gas cost of issue() and anchor() in your summary.
```

**Verify:** `forge test -vvv` all green; `forge coverage` above 90% on both contracts.

---

# PHASE 4 — Supabase clients, auth, middleware

**Goal:** login works, roles route correctly.

```
Implement the data and auth layer in apps/web:

1. src/lib/supabase/client.ts (browser, anon key), server.ts (RSC + Route
   Handlers, cookie-based via @supabase/ssr), admin.ts (service role, with a
   top-of-file `import 'server-only'` guard).
2. middleware.ts — refresh the Supabase session, then role-route:
   unauthenticated → /login; role 'tourist' hitting /(command)/* → /home;
   roles admin|responder hitting /(tourist)/* → /dashboard.
3. src/lib/auth/roles.ts and guards.ts — requireRole() helpers for RSC and
   Route Handlers that throw a typed AuthError.
4. app/(auth)/login/page.tsx — three tabs: email magic link, demo tourist
   (anonymous sign-in, auto-creates a tourists row), demo officer
   (seeded credentials from env). The demo buttons are essential; judges will
   not wait for a magic-link email.
5. app/(auth)/callback/route.ts — code exchange.
6. app/api/health/route.ts — returns { ok, db: <SELECT 1 latency ms>,
   chain: <block number or null>, ai: <hf reachable>, version }. This is the
   keepalive target and your live status panel.
7. A trigger-backed src/lib/auth/ensure-profile.ts that creates the profiles row
   on first sign-in.
8. Root app/page.tsx — landing page with a QR code (use `qrcode` npm) pointing
   at /login so a judge can open the tourist PWA on their own phone instantly.

Handle the "anonymous user has no email" case explicitly.
```

**Verify:** all three login paths work; role routing enforced.

---

# PHASE 5 — Map foundation

**Goal:** a fast, reusable MapLibre layer both personas share.

```
Build the mapping layer in apps/web:

1. src/components/map/MapCanvas.tsx — MapLibre GL JS v5 wrapper.
   - Style from NEXT_PUBLIC_MAP_STYLE_URL, switching to a local PMTiles source
     (protomaps-leaflet / pmtiles protocol) when NEXT_PUBLIC_MAP_TILE_MODE
     is 'pmtiles-local'.
   - Props: initialCenter, initialZoom, children (declarative layer components
     via a MapContext), onMapLoad.
   - Must not re-create the map instance on re-render. Handle StrictMode double
     mount. Clean up on unmount.
2. src/components/map/ZoneLayer.tsx — GeoJSON fill+line layers coloured by
   risk_level (none→slate, low→emerald, medium→amber, high→orange,
   critical→red), 0.25 fill opacity, click → popup with name, category, advisory.
3. src/components/map/TouristLayer.tsx — symbol layer with clustering above 50
   markers, marker colour driven by safety_score, pulsing halo for score < 40.
4. src/components/map/IncidentLayer.tsx — animated pulsing pins by severity,
   click → select incident.
5. src/components/map/TrackReplay.tsx — renders a LineString with a time
   scrubber and an animated position dot.
6. src/components/map/ZoneDrawEditor.tsx — Terra Draw polygon/circle drawing
   wired to MapLibre, emitting GeoJSON on complete.
7. src/lib/geo/pmtiles.ts — registers the pmtiles:// protocol handler.
8. tools/seed-data/export-pmtiles.sh — downloads the Northeast India OSM extract
   from Geofabrik and converts it to PMTiles with tippecanoe, documenting the
   commands.

All layers must be declarative children of MapCanvas and handle the map not
being loaded yet. Use useMemo on GeoJSON to avoid re-serialising every render.
```

**Verify:** zones render over Guwahati; hot reload does not leak map instances.

---

# PHASE 6 — Tourist PWA: tracking & geofencing

**Goal:** the tourist half, working offline.

```
Build the tourist experience in apps/web/src/app/(tourist)/:

1. hooks/useGeolocationTracker.ts
   - navigator.geolocation.watchPosition with enableHighAccuracy.
   - Adaptive cadence: PING_INTERVAL_MOVING_MS when speed > 0.5 m/s,
     PING_INTERVAL_STATIONARY_MS otherwise, PING_INTERVAL_SOS_MS for 30 min
     after an SOS.
   - Discards fixes with accuracy_m > 100 unless nothing better arrives in 60 s.
   - Reads position.coords.speed/heading, plus navigator.getBattery().
   - Writes directly to Supabase location_pings (RLS-guarded), NOT through an
     API route.
   - Offline: queue in IndexedDB (use `idb`), flush on reconnect and via
     Background Sync. Never lose a ping.
2. hooks/useLocalGeofence.ts — caches nearby zones as GeoJSON (refresh every
   5 min and on Realtime zone changes), evaluates every fix locally with
   @turf/boolean-point-in-polygon, and fires an instant in-app warning +
   navigator.vibrate on breach, before the server round trip.
3. hooks/useOnlineStatus.ts, hooks/usePushSubscription.ts (VAPID subscribe →
   POST /api/notify/subscribe).
4. Pages:
   - onboard/page.tsx — first step is residency: Indian → Continue with
     DigiLocker (OAuth; after allow, fetch eAadhaar XML + issued docs) or
     type Aadhaar / Voter ID / DL; international → passport. Then name,
     DOB, emergency contacts, trip dates, itinerary from preset NE routes.
     Submits to /api/identity/issue. Optimistic progress UI
     with the on-chain step shown explicitly — judges like watching the tx land.
   - onboard/digilocker/page.tsx — demo DigiLocker consent (used when
     DIGILOCKER_CLIENT_ID is unset). Live mode redirects to meripehchaan.gov.in.
   - home/page.tsx — SafetyScoreGauge (animated SVG arc), current zone banner
     coloured by risk, next waypoint, connection + tracking status pills.
   - map/page.tsx — own position, zone overlays, itinerary corridor as a
     translucent buffer.
   - id/page.tsx — DigitalIdCard with photo, masked KYC, validity, a QR of
     { chainId, contract, tokenId, vcPath }, and a link to the Polygonscan tx.
   - trip/page.tsx — itinerary timeline with manual check-in buttons.
   - alerts/page.tsx — notification history from the notifications table.
5. components/tourist/PanicButton.tsx — hold 1.5 s with a filling ring to
   confirm, haptic feedback, optimistic "SENDING" state, direct Supabase insert
   of an incident with type='sos' severity='critical'. On failure, falls back to
   an `sms:` intent URI with a pre-composed message containing the coordinates.
6. public/manifest.webmanifest and public/sw.js — offline app shell, push
   handler that renders a notification with actions, background sync for the
   ping queue, and notificationclick → focus the app on the alert.
7. (tourist)/layout.tsx — permission priming UI (explain before requesting),
   bottom tab nav, service worker registration.

Everything must work with the network disabled after first load.
```

**Verify:** install on a real phone, walk into a seeded zone, get a warning with airplane mode on.

---

# PHASE 7 — Digital ID API

**Goal:** issuance and verification, end to end.
**Attach:** `packages/contracts/deployments/amoy.json`, `packages/shared/src/utils/hash.ts`

```
Implement the blockchain identity layer in apps/web:

1. src/lib/chain/clients.ts — viem publicClient and walletClient using
   fallback([http(primary), http(fb1), http(fb2)]) with retryCount 2. When
   CHAIN_MODE='anvil-local' use the local chain; when 'disabled', export
   no-op stubs so the rest of the app still runs.
2. src/lib/chain/hd.ts — derive a tourist wallet from TOURIST_HD_MNEMONIC at
   m/44'/60'/0'/0/{hd_index}, allocating hd_index atomically from Postgres.
3. src/lib/chain/registry.ts — typed issue/revoke/verify/extendValidity/
   updateItinerary wrappers with gas estimation and receipt waiting.
4. src/lib/chain/anchor.ts — anchor + verifyIntegrity + batch drain.
5. src/lib/chain/vc.ts — build a W3C Verifiable Credential, sign it EIP-712
   with the issuer key, and verify a presented one.
6. Route handlers:
   - POST /api/identity/issue — Zod validate → encrypt kyc_number with pgcrypto
     → generate salt → compute commitment and itinerary hash → insert tourist +
     itinerary → derive wallet → send issue() tx → build and store the VC in
     Supabase Storage → insert digital_ids and chain_anchors → return tokenId,
     txHash, explorer URL, QR payload.
     Must be idempotent on retry (dedupe by commitment).
     If the chain write fails, the tourist row is still created and the
     digital_ids row stays 'pending' for the retry job — onboarding never blocks
     on the chain.
   - GET /api/identity/verify?tokenId= — eth_call verify(), fetch and check the
     VC signature, return a verdict object with reason codes.
   - POST /api/identity/verify-kyc — selective disclosure via verifyKyc().
   - POST /api/identity/revoke — admin only, on-chain revoke + status update +
     audit_log row.
   - GET /api/identity/digilocker/start — PKCE + state cookie, redirect to
     DigiLocker authorize (live) or /onboard/digilocker (demo).
   - GET /api/identity/digilocker/callback — exchange code, fetch user +
     eAadhaar XML + issued files, HMAC-check XML, set a short-lived KYC
     cookie, redirect to /onboard. Never log the XML or Aadhaar.
   - GET/DELETE /api/identity/digilocker/session — onboard reads the fetched
     profile (name, DOB, Aadhaar) to prefill the form.
   - POST /api/chain/retry — drains chain_anchors where status in
     ('pending','failed'), HMAC-verified against PIPELINE_SECRET.
7. src/lib/utils/hmac.ts — timing-safe verification of the x-pipeline-secret
   header for all pg_net-originated calls.

Never log a private key, a salt, or a raw KYC number. Add an ESLint rule if
that helps.
```

**Verify:** issue an ID, see the tx on Amoy Polygonscan, verify it, revoke it, verify it fails.

---

# PHASE 8 — Command dashboard

**Goal:** the screen the judges actually look at.

```
Build the command centre in apps/web/src/app/(command)/:

1. RealtimeProvider.tsx — one Supabase Realtime channel subscribing to
   incidents, dispatches, and tourists; exposes context with reconnect handling,
   presence, and a visible connection-status indicator.
2. dashboard/page.tsx — the money screen:
   - KpiStrip: active tourists, open incidents by severity, mean time to
     acknowledge, mean time to resolve, on-duty responders, anchored-incident
     count. All live.
   - Full-bleed MapCanvas with ZoneLayer + TouristLayer + IncidentLayer.
   - Right rail IncidentQueue sorted critical-first, newest-first, with an
     audible chime and a red flash on a new critical incident.
   - Clicking a queue item flies the map to it and opens the detail drawer.
3. incidents/[id]/page.tsx — the depth screen:
   - Header: type, severity, status, elapsed timer.
   - AI brief panel (with the model name and a "regenerate" button).
   - Tourist card: name, nationality, photo, emergency contacts, digital ID
     status with an on-chain ChainProofBadge.
   - Map with the last 60 minutes of track and the zone that triggered it.
   - IncidentTimeline from incident_events, append-only.
   - DispatchPanel: three nearest responders with distance and ETA,
     one-click dispatch, live status.
   - ChainProofBadge: recomputes the record hash client-side, calls
     verifyIntegrity(), renders green "Verified on Polygon Amoy · block N"
     with an explorer link, or red "Integrity broken".
   - Actions: acknowledge, escalate, resolve with notes, mark false positive,
     generate E-FIR.
4. tourists/page.tsx + [id]/page.tsx — searchable roster, safety-score sort,
   track replay, score history sparkline, ID verification panel.
5. zones/page.tsx — Terra Draw editor, risk level and time-window form,
   ST_IsValid feedback, overlap warnings, save via a Server Action.
6. responders/page.tsx — duty roster with coverage circles on the map.
7. analytics/page.tsx — incident heatmap by zone, MTTA/MTTR trend, incident type
   distribution, zone risk ranking from v_zone_risk_ranking. Recharts.
8. verify/page.tsx — camera QR scanner → on-chain verification card. Build this;
   it is a 20-second demo beat that lands well.

Dark control-room theme. Every mutation goes through a Server Action that writes
audit_log. Optimistic UI with rollback on failure.
```

**Verify:** open two browsers, insert an incident by hand, confirm it appears in both in under a second.

---

# PHASE 9 — AI service (Python)

**Goal:** a real, trained anomaly model, not a random number.

```
Build services/ai — a FastAPI app for Hugging Face Spaces (free CPU Basic):

1. app/features.py — from a list of pings in a time window, extract:
   speed mean/std/max, acceleration std, bearing change entropy, stop count and
   total stop duration (DBSCAN eps=50 m), distance from itinerary LineString,
   radius of gyration, straightness index (net/gross displacement),
   night fraction, zone-risk-weighted dwell time, ping gap mean/max,
   battery slope. Return a fixed-order 18-feature vector; document the order in
   a module constant that the TS side imports.
2. app/models/isolation_forest.py — train/predict, contamination=0.05,
   with a StandardScaler whose parameters are exported to JSON.
3. app/models/stop_detection.py — DBSCAN stop-point clustering distinguishing
   an accommodation stop from an anomalous roadside stop.
4. app/models/safety_score.py — composite 0-100 blend that returns not just the
   score but a per-factor contribution breakdown, so the UI can explain it.
5. app/main.py — POST /score (window of pings + itinerary + zone context →
   {anomaly_score, is_anomaly, safety_score, factors[], model_version}),
   POST /score/batch, GET /health, GET /model/info. Pydantic v2 models.
   CORS for the Vercel domain. Sub-200 ms p95 on CPU.
6. notebooks/train_and_export.ipynb — trains on the synthetic dataset from
   Phase 10, evaluates precision/recall/F1 against the injected labels, plots a
   confusion matrix, and exports iforest.onnx via skl2onnx plus scaler.json.
   Print the metrics table; you will put it on a slide.
7. Dockerfile + README.md with the HF Space front-matter block
   (sdk: docker, app_port: 7860).
8. tests/test_score.py — golden-vector tests so the ONNX and sklearn paths agree.

Warn me in your summary if any feature would be unavailable in the browser-side
ONNX fallback path.
```

**Verify:** Space deploys and responds; sklearn and ONNX outputs agree within 1e-5.

---

# PHASE 10 — Simulator & synthetic data

**Goal:** the thing that drives your entire demo. Do not skip or rush this.

```
Build tools/simulator — a CLI that drives realistic tourist movement:

  pnpm sim --tourists 25 --scenario zone-breach --speed 5x

1. src/routes/ — real polylines from OSM for: Guwahati→Shillong (NH6),
   Shillong→Cherrapunji, Tezpur→Bomdila→Tawang, Kaziranga safari loop,
   Dzukou Valley trek, Imphal→Loktak. Store as GeoJSON LineStrings.
2. src/engine.ts — per-tourist state machine walking a route with realistic
   speed profiles (walking 1.2 m/s, car 40 km/h with traffic variance, trek
   0.8 m/s uphill), GPS noise (σ = 8 m), occasional 30 s dropouts, battery
   drain, and dwell at waypoints.
3. src/scenarios/ — each returns a movement plan:
   - normal-trek: nothing fires. Proves you do not spam false positives —
     judges test this.
   - zone-breach: tourist walks steadily toward a restricted zone and crosses
     it at a predictable moment. THE demo scenario. Print a countdown to the
     console so you can narrate it.
   - signal-loss: pings stop for 25 minutes.
   - route-deviation: gradual drift 3 km off the itinerary corridor.
   - panic-sos: tourist presses SOS mid-route.
   - stationary-anomaly: motionless 50 min on a highway at 02:00.
4. src/emit.ts — inserts pings via supabase-js using each tourist's own JWT so
   RLS is genuinely exercised, not bypassed with the service role.
5. tools/seed-data/generate-trajectories.ts — produces a labelled synthetic
   training set for Phase 9: 5,000 normal windows and 500 anomalous ones across
   all six scenarios, exported as CSV plus a JSON label file.
6. A --replay flag that plays back a recorded session deterministically, so your
   demo is identical every rehearsal.
7. Coloured console output showing each tourist's position, zone, and score, so
   the simulator terminal is itself presentable on a second screen.

Determinism matters: a --seed flag must make runs byte-identical.
```

**Verify:** `--scenario zone-breach` fires exactly one incident; `--scenario normal-trek` for 10 minutes fires zero.

---

# PHASE 11 — Incident pipeline & AI integration

**Goal:** wire detection to intelligence.

```
Implement the enrichment and reasoning layer in apps/web:

1. POST /api/pipeline/incident — invoked by pg_net. HMAC-verified. Steps:
   a. Load the incident, tourist, zone, and the last 60 min of pings.
   b. Reverse geocode via Photon (cached in a Postgres table keyed by a
      100 m geohash — never hit the free service twice for the same place).
   c. Call the scoring service: HF Space → on timeout/5xx fall back to
      src/lib/ai/onnx-local.ts (onnxruntime-node) → fall back to rules-only.
      Log which path was taken into incident.payload.score_source.
   d. If anomaly_score > ANOMALY_THRESHOLD, escalate severity one level and set
      detected_by='rules+ml'.
   e. Generate the AI brief, then compute record_hash and enqueue a chain anchor
      if severity >= ANCHOR_MIN_SEVERITY.
   f. Trigger dispatch.
   Total budget 8 seconds; each stage independently degradable. The endpoint
   returns 200 even if optional stages fail, and records what failed.
2. src/lib/ai/providers.ts — Vercel AI SDK v6, Groq primary, Gemini fallback,
   selected by AI_MODE, with a 10 s timeout and one retry.
3. src/lib/ai/prompts.ts:
   - incidentBrief: two sentences, factual, no speculation, names the zone and
     the elapsed time. Explicitly instructed never to invent details.
   - efirNarrative: a formal missing-person E-FIR narrative from the structured
     record, in Indian police report register, with a clear
     [OFFICER TO VERIFY] marker on every inferred fact.
   - translateAlert: target language from tourists.locale.
   - nlQuery: natural language → parameterised SQL.
4. src/lib/ai/nl-sql.ts — compiles NL queries against ONLY the allow-listed
   views (v_live_tourists, v_open_incidents, v_zone_risk_ranking). Rejects any
   generated SQL containing DDL/DML keywords, executes with a read-only role and
   a statement_timeout of 3 s, and always returns the SQL it ran so the operator
   can see it. Treat this as untrusted input end to end.
5. POST /api/ai/efir — LLM narrative → React-PDF → Supabase Storage → email via
   Resend → anchor the PDF sha256 on chain → insert efir_drafts.
6. POST /api/ai/brief — regenerate on demand.
7. Structured logging of every AI call: model, latency, tokens, fallback used.

The LLM must never decide whether an alert fires. It only explains and formats
decisions already made. Add a comment saying so where it would be tempting.
```

**Verify:** kill the HF Space and confirm incidents still complete via ONNX; kill the network and confirm they still complete rules-only.

---

# PHASE 12 — Notification dispatch

**Goal:** multi-channel alerting that survives a channel outage.

```
Implement notification fan-out in apps/web:

1. src/lib/notify/dispatcher.ts — orchestrator:
   - Resolve recipients: the tourist, the 3 nearest on-duty responders
     (app.nearest_responders), the control room, and emergency contacts for
     severity='critical'.
   - Fan out to the channels in NOTIFY_CHANNELS in parallel with
     Promise.allSettled. One channel failing must never block another.
   - Write a notifications row per recipient per channel, before and after.
   - Exponential backoff retry (3 attempts) for transient failures only.
2. channels/webpush.ts — `web-push` with VAPID; prune 410/404 subscriptions
   automatically.
3. channels/telegram.ts — sendMessage with MarkdownV2 (escape properly),
   a static map thumbnail rendered from the coordinates, and an inline keyboard
   with Acknowledge / Dispatch / Resolve callback buttons.
4. POST /api/notify/telegram-webhook — verifies the secret token header, handles
   callback_query, updates the dispatch, answers the callback, and edits the
   original message in place to show who acknowledged and when.
5. channels/email.ts — Resend, with a React Email template for the incident
   alert and one for the E-FIR with the PDF attached.
6. channels/realtime.ts — Supabase broadcast for the dashboard and the tourist's
   own channel.
7. channels/sms.stub.ts — implements INotificationChannel, throws
   NotConfiguredError, with a comment explaining that SMS is the one genuinely
   paid channel and how to enable it in 40 lines.
8. POST /api/notify/subscribe — store a push subscription.
9. POST /api/dispatch/ack and /resolve — from Telegram or the dashboard; both
   write incident_events and broadcast.
10. Localised message templates for en, hi, as, bn, ne.

Target: SOS insert to Telegram message delivered in under 2 seconds. Instrument
and log the actual figure — you will quote it on stage.
```

**Verify:** press SOS on a phone; the Telegram group message arrives in under 2 s; tapping Acknowledge updates the dashboard.

---

# PHASE 13 — Hardening, offline mode, and demo prep

**Goal:** nothing fails on stage.

```
Final hardening pass:

1. Offline mode: make every one of DB_MODE, CHAIN_MODE, AI_MODE, and
   NEXT_PUBLIC_MAP_TILE_MODE actually work at their local values. Write
   docs/OFFLINE-DEMO.md with the exact command sequence to bring the whole
   system up with the network cable unplugged, and verify it yourself.
2. Seed a "demo reset" script: `pnpm demo:reset` truncates incidents,
   dispatches, notifications and pings, restores the seeded zones, tourists and
   responders, and leaves the system in a known state in under 10 seconds.
   You will run this between judging slots.
3. Error boundaries on every route group; a global not-found and error page;
   Sentry wiring behind the optional DSN.
4. Loading skeletons for every async surface. No layout shift on the dashboard.
5. Accessibility pass: keyboard navigation on the incident queue, ARIA live
   region announcing new critical incidents, focus management in the drawer,
   and a check that severity is never conveyed by colour alone.
6. Rate limiting on public routes (in-memory token bucket is fine at this
   scale), Zod validation on every input, and a security headers block in
   next.config.ts (CSP allowing the MapLibre worker and the tile host).
7. Lighthouse pass: PWA installable, performance > 90 on the tourist app.
8. tests/e2e/*.spec.ts — Playwright for the three critical flows:
   identity issue+verify, geofence breach end to end, SOS end to end.
9. docs/DEMO-SCRIPT.md — a minute-by-minute 6-minute runbook: who clicks what,
   which simulator scenario runs when, what you say while the transaction
   confirms, and a designated recovery action for each of the top 5 failure
   modes.
10. docs/JUDGE-QA.md — 25 hostile questions with prepared answers. Include at
    minimum: "why blockchain and not a database", "your AI is trained on fake
    data", "what about GPS in low-connectivity Arunachal", "how is this DPDP
    compliant", "what does this cost to run at 10,000 tourists", "what happens
    when the tourist's battery dies", "isn't this surveillance".
11. README.md — architecture diagram, 3-command setup, live demo URLs, a table
    proving every component's free tier, and the measured SOS latency figure.

Report anything you could not make work offline.
```

**Verify:** unplug the network, run the full 6-minute demo script start to finish.

---

## Appendix A — Repair prompt pattern

When a phase produces broken code, do **not** describe the bug in prose and hope. Use this:

```
The code from the previous step fails. Here is the exact evidence:

COMMAND: <the command you ran>
ERROR:
<full error output, unedited, including the stack trace>

RELEVANT FILE (<path>):
<paste the file, or attach it>

Diagnose the root cause before writing any code. State the cause in one
sentence, then give me the complete corrected file. Do not refactor anything
unrelated. Do not change the approved stack.
```

## Appendix B — Phase dependency graph

```
0 ──► 1 ──► 2 ──┬──► 3 (contracts)  ──┐
                ├──► 4 (auth)  ──► 5 (map) ──┬──► 6 (tourist PWA) ──┐
                └──► 10 (simulator) ─────────┘                      │
                                                                    │
        3 + 4 ──────────────────► 7 (identity API) ─────────────────┤
        5 + 4 ──────────────────► 8 (dashboard) ────────────────────┤
        10 ─────────────────────► 9 (AI service) ───────────────────┤
        7 + 8 + 9 ──────────────► 11 (pipeline) ────────────────────┤
        11 ─────────────────────► 12 (notifications) ───────────────┤
                                                                    └──► 13
```

Phases 3, 4, and 10 are independent after Phase 2 — split them across teammates. Phase 10 is on the critical path for Phase 9, so start the simulator early; it is also the phase most teams underestimate.

## Appendix C — Budget guidance

If you are short on time, the minimum viable demo is phases **0, 1, 2, 4, 5, 6, 8, 10** plus a stubbed identity page. That gives you live tracking, geofencing, real-time dashboard, and SOS — the core of the problem statement. Add Phase 3 + 7 next (blockchain is the differentiator on this PS), then 12 (notifications are visible on stage), then 9 + 11 (AI is the easiest to hand-wave convincingly if it is only rules-based, since your rules layer is genuinely good).

Do not ship a half-built blockchain. Either the contract is deployed, verified, and demonstrated live, or you cut it and say you designed for it. A superficial implementation is worse than none on this problem statement.
