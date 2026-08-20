# 3. Folder & File Structure

A pnpm-workspace monorepo. Four deployable units (`apps/web` → Vercel, `services/ai` → HF Spaces, `packages/contracts` → Polygon Amoy, `supabase/` → Supabase), plus shared types and tooling.

```
smart-tourist-safety/
│
├── README.md                              # 60-second setup, demo script, architecture image
├── LICENSE                                # MIT
├── package.json                           # workspace root, scripts: dev / build / db / chain / sim
├── pnpm-workspace.yaml
├── turbo.json                             # optional: task graph & caching
├── .gitignore
├── .env.example                           # ← see docs/05-ENV.md (single source of truth)
├── .nvmrc                                 # 24
├── docker-compose.yml                     # local Supabase + Anvil for the offline demo
├── vercel.json                            # build config, cron, headers (or vercel.ts)
│
├── docs/
│   ├── 01-TECH-STACK.md
│   ├── 02-ARCHITECTURE.md
│   ├── 03-REPO-STRUCTURE.md
│   ├── 04-DATA-MODEL.md                   # schema + contract spec narrative
│   ├── 05-ENV.md
│   ├── 06-GROK-PROMPTS.md                 # the build sequence
│   ├── DEMO-SCRIPT.md                     # 6-minute stage runbook, minute by minute
│   ├── JUDGE-QA.md                        # 25 hostile questions + prepared answers
│   ├── PRIVACY-DPDP.md                    # DPDP Act 2023 compliance note
│   └── diagrams/
│       ├── architecture.excalidraw
│       └── sequence-sos.md                # mermaid
│
├── .github/
│   └── workflows/
│       ├── ci.yml                         # typecheck, lint, forge test, vitest
│       ├── keepalive.yml                  # cron */6h → GET /api/health (stops Supabase pausing)
│       └── contracts-deploy.yml           # manual dispatch → forge script → Amoy + verify
│
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   ├── 20250101000000_extensions.sql          # postgis, pgcrypto, pg_cron, pg_net, h3 (opt)
│   │   ├── 20250101000100_enums.sql
│   │   ├── 20250101000200_core_tables.sql         # tourists, digital_ids, itineraries
│   │   ├── 20250101000300_spatial_tables.sql      # zones, location_pings, location_tracks
│   │   ├── 20250101000400_incident_tables.sql     # incidents, incident_events, responders,
│   │   │                                          #   dispatches, notifications, efir_drafts
│   │   ├── 20250101000500_chain_tables.sql        # chain_anchors, audit_log
│   │   ├── 20250101000600_indexes.sql             # GiST, BRIN on time, partial uniques
│   │   ├── 20250101000700_functions.sql           # evaluate_position, safety_score, nearest_responders
│   │   ├── 20250101000800_triggers.sql            # AFTER INSERT on location_pings / incidents
│   │   ├── 20250101000900_rls.sql                 # policies for tourist / responder / admin
│   │   ├── 20250101001000_cron.sql                # sweeper, downsampler, retention, anchor retry
│   │   └── 20250101001100_views.sql               # v_live_tourists, v_open_incidents, nl-query allow-list
│   ├── seed/
│   │   ├── 01_zones_northeast.sql          # Kaziranga, Tawang, Cherrapunji, Loktak, border strips
│   │   ├── 02_responders.sql               # police stations + tourist-police units w/ coords
│   │   ├── 03_demo_tourists.sql
│   │   └── geojson/
│   │       ├── zones-safe.geojson
│   │       ├── zones-restricted.geojson
│   │       └── itineraries-demo.geojson
│   └── functions/                          # Supabase Edge Functions (only if needed)
│       └── on-incident/index.ts
│
├── packages/
│   │
│   ├── shared/                             # @sts/shared — imported by web, simulator, tests
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── schemas/
│   │   │   │   ├── tourist.ts              # Zod: TouristCreate, TouristPublic
│   │   │   │   ├── ping.ts                 # Zod: LocationPing
│   │   │   │   ├── zone.ts                 # Zod: Zone, RiskLevel, TimeWindow
│   │   │   │   ├── incident.ts             # Zod: Incident, Severity, IncidentType
│   │   │   │   ├── identity.ts             # Zod: IssueRequest, VerifyResponse, VC
│   │   │   │   ├── digilocker.ts           # Zod: fetched DigiLocker session
│   │   │   │   └── notification.ts
│   │   │   ├── types/
│   │   │   │   └── database.ts             # generated: supabase gen types typescript
│   │   │   ├── constants/
│   │   │   │   ├── severity-matrix.ts      # zone.risk × type × time-of-day → severity
│   │   │   │   ├── scoring-weights.ts
│   │   │   │   └── chains.ts               # Amoy + Anvil chain defs for viem
│   │   │   └── utils/
│   │   │       ├── geo.ts                  # haversine, bbox, geojson↔wkt
│   │   │       ├── hash.ts                 # keccak256 canonicalisation (deterministic JSON)
│   │   │       ├── kyc.ts                  # Aadhaar Verhoeff, passport ICAO, nationality policy
│   │   │       ├── digilocker.ts           # eAadhaar XML parse, issued-doctype map, demo profile
│   │   │       └── time.ts
│   │   └── tsconfig.json
│   │
│   └── contracts/                          # @sts/contracts — Foundry
│       ├── foundry.toml
│       ├── remappings.txt
│       ├── lib/                            # forge install: openzeppelin-contracts, forge-std
│       ├── src/
│       │   ├── TouristIdentityRegistry.sol # ERC-721 + ERC-5192 soulbound DID
│       │   ├── IncidentAnchor.sol          # tamper-evident incident/E-FIR anchoring
│       │   ├── interfaces/
│       │   │   ├── ITouristIdentityRegistry.sol
│       │   │   ├── IIncidentAnchor.sol
│       │   │   └── IERC5192.sol
│       │   └── libraries/
│       │       └── Commitments.sol         # keccak commitment helpers
│       ├── test/
│       │   ├── TouristIdentityRegistry.t.sol   # issue, expiry, revoke, soulbound revert, roles
│       │   ├── IncidentAnchor.t.sol
│       │   └── Invariants.t.sol            # fuzz: no transfer ever succeeds
│       ├── script/
│       │   ├── Deploy.s.sol
│       │   └── SeedDemo.s.sol
│       ├── deployments/
│       │   ├── amoy.json                   # address, block, abi hash — committed
│       │   └── anvil.json
│       └── out/                            # gitignored; ABIs copied to apps/web/src/lib/chain/abi
│
├── apps/
│   └── web/                                # Next.js 16 — tourist PWA + command dashboard
│       ├── package.json
│       ├── next.config.ts
│       ├── tailwind.config.ts
│       ├── components.json                 # shadcn config
│       ├── middleware.ts                   # Supabase session refresh + role routing
│       ├── public/
│       │   ├── manifest.webmanifest
│       │   ├── sw.js                       # service worker: push, background sync, offline shell
│       │   ├── icons/                      # 192/512 maskable
│       │   ├── styles/liberty.json         # MapLibre style (offline copy)
│       │   └── tiles/northeast.pmtiles     # ~80 MB offline basemap (Git LFS or Storage)
│       └── src/
│           ├── app/
│           │   ├── layout.tsx
│           │   ├── globals.css
│           │   ├── page.tsx                # landing + role chooser + QR for phones
│           │   │
│           │   ├── (auth)/
│           │   │   ├── login/page.tsx
│           │   │   ├── login/digilocker/page.tsx  # DigiLocker portal: sign-in → allow → fetch
│           │   │   └── callback/route.ts
│           │   │
│           │   ├── (tourist)/
│           │   │   ├── layout.tsx          # bottom nav, permission prompts, SW registration
│           │   │   ├── onboard/page.tsx    # DigiLocker portal or Aadhaar (IN) / passport (intl) → digital ID
│           │   │   ├── onboard/digilocker/page.tsx  # same DigiLocker portal inside tourist layout
│           │   │   ├── home/page.tsx       # safety score gauge, current zone, weather-ish banner
│           │   │   ├── map/page.tsx        # own position + zone overlays + itinerary corridor
│           │   │   ├── id/page.tsx         # digital ID card + QR + on-chain proof link
│           │   │   ├── sos/page.tsx        # full-screen panic button + hold-to-confirm
│           │   │   ├── trip/page.tsx       # itinerary, check-ins, companions
│           │   │   └── alerts/page.tsx     # notification history
│           │   │
│           │   ├── (command)/
│           │   │   ├── layout.tsx          # dark control-room shell, role guard
│           │   │   ├── dashboard/page.tsx  # KPI strip + live map + incident queue
│           │   │   ├── incidents/
│           │   │   │   ├── page.tsx
│           │   │   │   └── [id]/page.tsx   # timeline, AI brief, dispatch, anchor proof, E-FIR
│           │   │   ├── tourists/
│           │   │   │   ├── page.tsx        # searchable roster + cluster heatmap
│           │   │   │   └── [id]/page.tsx   # track replay, score history, ID verification
│           │   │   ├── zones/page.tsx      # Terra Draw geofence editor
│           │   │   ├── responders/page.tsx # duty roster, coverage circles
│           │   │   ├── verify/page.tsx     # QR scanner → on-chain verification card
│           │   │   └── analytics/page.tsx  # incident heatmap, MTTA/MTTR, zone risk ranking
│           │   │
│           │   └── api/
│           │       ├── health/route.ts
│           │       ├── identity/
│           │       │   ├── issue/route.ts
│           │       │   ├── verify/route.ts
│           │       │   ├── revoke/route.ts
│           │       │   └── digilocker/{start,callback,session}/route.ts
│           │       ├── pipeline/
│           │       │   └── incident/route.ts       # called by pg_net; HMAC-verified
│           │       ├── ai/
│           │       │   ├── score/route.ts
│           │       │   ├── brief/route.ts
│           │       │   ├── efir/route.ts
│           │       │   └── nl-query/route.ts
│           │       ├── notify/
│           │       │   ├── dispatch/route.ts
│           │       │   ├── subscribe/route.ts      # store Web Push subscription
│           │       │   └── telegram-webhook/route.ts
│           │       ├── dispatch/
│           │       │   ├── ack/route.ts
│           │       │   └── resolve/route.ts
│           │       └── geo/
│           │           ├── reverse/route.ts        # Photon proxy + cache
│           │           └── route/route.ts          # OSRM proxy for ETA
│           │
│           ├── components/
│           │   ├── ui/                     # shadcn primitives
│           │   ├── map/
│           │   │   ├── MapCanvas.tsx       # MapLibre wrapper, style switching
│           │   │   ├── TouristLayer.tsx    # live markers + clustering
│           │   │   ├── ZoneLayer.tsx       # fill by risk_level
│           │   │   ├── IncidentLayer.tsx   # pulsing pins
│           │   │   ├── ZoneDrawEditor.tsx  # Terra Draw
│           │   │   └── TrackReplay.tsx     # scrubber over a historical LineString
│           │   ├── tourist/
│           │   │   ├── SafetyScoreGauge.tsx
│           │   │   ├── PanicButton.tsx
│           │   │   ├── DigitalIdCard.tsx
│           │   │   └── GeofenceWarning.tsx
│           │   ├── command/
│           │   │   ├── IncidentQueue.tsx
│           │   │   ├── IncidentTimeline.tsx
│           │   │   ├── DispatchPanel.tsx
│           │   │   ├── KpiStrip.tsx
│           │   │   ├── ChainProofBadge.tsx  # verified / integrity-broken
│           │   │   └── NlQueryBar.tsx
│           │   └── shared/
│           │       ├── QrScanner.tsx
│           │       └── RealtimeProvider.tsx
│           │
│           ├── hooks/
│           │   ├── useGeolocationTracker.ts   # adaptive cadence + IndexedDB queue
│           │   ├── useLocalGeofence.ts        # Turf.js pre-check
│           │   ├── useRealtimeIncidents.ts
│           │   ├── useRealtimeTourists.ts
│           │   ├── usePushSubscription.ts
│           │   └── useOnlineStatus.ts
│           │
│           └── lib/
│               ├── supabase/
│               │   ├── client.ts           # browser (anon key)
│               │   ├── server.ts           # RSC/route handler (cookies)
│               │   ├── admin.ts            # service role — server only
│               │   └── realtime.ts
│               ├── chain/
│               │   ├── clients.ts          # viem public+wallet, fallback([...rpcs])
│               │   ├── registry.ts         # issue / verify / revoke wrappers
│               │   ├── anchor.ts
│               │   ├── hd.ts               # BIP-44 derivation per tourist
│               │   ├── vc.ts               # EIP-712 Verifiable Credential sign/verify
│               │   └── abi/                # generated from forge out/
│               ├── ai/
│               │   ├── providers.ts        # AI SDK v6: groq primary, gemini fallback
│               │   ├── score-client.ts     # HF Space → ONNX local → rules
│               │   ├── onnx-local.ts       # onnxruntime-node
│               │   ├── prompts.ts          # brief, efir, translate, nl-query
│               │   └── nl-sql.ts           # allow-listed view compiler + guards
│               ├── notify/
│               │   ├── dispatcher.ts       # fan-out orchestrator
│               │   ├── channels/
│               │   │   ├── webpush.ts
│               │   │   ├── telegram.ts
│               │   │   ├── email.ts        # Resend
│               │   │   ├── realtime.ts
│               │   │   └── sms.stub.ts     # interface only; documented as paid
│               │   └── templates/
│               ├── geo/
│               │   ├── photon.ts
│               │   ├── osrm.ts
│               │   └── pmtiles.ts
│               ├── auth/
│               │   ├── roles.ts            # tourist | responder | admin
│               │   └── guards.ts
│               └── utils/
│                   ├── hmac.ts             # verifies pg_net → /api/pipeline calls
│                   ├── pdf.ts              # E-FIR rendering
│                   └── cn.ts
│
├── services/
│   └── ai/                                 # FastAPI on Hugging Face Spaces
│       ├── Dockerfile
│       ├── README.md                       # HF Space card (required front-matter)
│       ├── requirements.txt                # fastapi, uvicorn, scikit-learn, numpy,
│       │                                   #   pandas, skl2onnx, shapely, pydantic
│       ├── app/
│       │   ├── main.py                     # POST /score /train /health
│       │   ├── features.py                 # windowed trajectory feature extraction
│       │   ├── models/
│       │   │   ├── isolation_forest.py
│       │   │   ├── stop_detection.py       # DBSCAN
│       │   │   └── safety_score.py         # composite blend
│       │   ├── schemas.py
│       │   └── config.py
│       ├── artifacts/
│       │   ├── iforest.onnx                # committed — the fallback the web app loads
│       │   ├── iforest.pkl
│       │   └── scaler.json
│       ├── notebooks/
│       │   └── train_and_export.ipynb
│       └── tests/
│           └── test_score.py
│
├── tools/
│   ├── simulator/                          # the demo driver — treat as a first-class app
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.ts                    # CLI: --tourists 25 --scenario breach --speed 5x
│   │   │   ├── scenarios/
│   │   │   │   ├── normal-trek.ts
│   │   │   │   ├── zone-breach.ts          # ← the money shot for the demo
│   │   │   │   ├── signal-loss.ts
│   │   │   │   ├── route-deviation.ts
│   │   │   │   ├── panic-sos.ts
│   │   │   │   └── stationary-anomaly.ts
│   │   │   ├── routes/                     # OSM-derived polylines: Guwahati–Shillong etc.
│   │   │   └── emit.ts                     # posts pings via supabase-js as a real tourist
│   │   └── README.md
│   ├── seed-data/
│   │   ├── generate-trajectories.ts        # synthetic labelled training set
│   │   └── export-pmtiles.sh               # OSM extract → PMTiles for offline maps
│   └── scripts/
│       ├── gen-types.sh                    # supabase gen types → packages/shared
│       ├── copy-abi.sh                     # forge out → apps/web/src/lib/chain/abi
│       └── check-freetier.sh               # asserts no paid env vars are set
│
└── tests/
    ├── e2e/                                # Playwright
    │   ├── sos-flow.spec.ts
    │   ├── geofence-breach.spec.ts
    │   └── identity-issue-verify.spec.ts
    └── integration/
        ├── evaluate-position.test.ts       # against local Supabase
        └── dispatch.test.ts
```

## Notes on a few deliberate choices

**`tools/simulator` is a first-class app, not a script.** Your demo is only as good as the tourists moving on the map. Build it early (Phase 3), give it scenario flags, and drive the entire pitch from it.

**ABIs are copied into the web app, not imported from `out/`.** `out/` is gitignored and Vercel does not run Foundry. `tools/scripts/copy-abi.sh` runs in `prebuild`.

**`supabase/migrations` are numbered and ordered so `supabase db reset` rebuilds everything from zero in about 20 seconds.** Never edit the database through the dashboard UI — every schema change is a migration file, or your offline fallback silently diverges from cloud.

**Both personas ship in one Next.js app.** Separate deployments would double the auth work for no benefit at hackathon scale.
