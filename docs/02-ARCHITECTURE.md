# 2. System Architecture & Data Flow

## 2.1 Component map

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                  CLIENTS                                     │
│                                                                              │
│  ┌────────────────────────────┐         ┌──────────────────────────────────┐ │
│  │  TOURIST PWA               │         │  COMMAND DASHBOARD               │ │
│  │  Next.js /(tourist)        │         │  Next.js /(command)              │ │
│  │  • Geolocation watchPosition│        │  • MapLibre live layer           │ │
│  │  • Turf.js local geofence  │         │  • Incident queue + triage       │ │
│  │  • Panic / SOS button      │         │  • Zone editor (Terra Draw)      │ │
│  │  • Digital ID QR (VC)      │         │  • Responder dispatch board      │ │
│  │  • Service Worker          │         │  • E-FIR generator               │ │
│  │    – Web Push receiver     │         │  • NL query bar                  │ │
│  │    – Background Sync queue │         │  • On-chain ID verifier          │ │
│  └──────────┬─────────────────┘         └───────────┬──────────────────────┘ │
│             │                                        │                       │
│  ┌──────────┴─────────────────┐                      │                       │
│  │  DEVICE SIMULATOR          │                      │                       │
│  │  tools/simulator (Node)    │  (stands in for the IoT band)                │
│  └──────────┬─────────────────┘                      │                       │
└─────────────┼────────────────────────────────────────┼───────────────────────┘
              │ (A) supabase-js insert                 │ (B) Realtime subscribe
              │     + RLS, hot path                    │     WebSocket
              ▼                                        ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                        SUPABASE (Postgres 15 + PostGIS 3)                    │
│                                                                              │
│   location_pings ──AFTER INSERT trigger──► evaluate_position()               │
│                                              │                               │
│        ┌─────────────────────────────────────┼──────────────────────┐        │
│        │  GEOFENCE ENGINE (plpgsql + PostGIS)│                      │        │
│        │  • ST_Contains(zone.geom, point)    │                      │        │
│        │  • ST_DWithin(itinerary_line, pt)   │                      │        │
│        │  • dwell-time / speed / silence     │                      │        │
│        │  • zone time-window rules           │                      │        │
│        └─────────────────────────────────────┼──────────────────────┘        │
│                                              ▼                               │
│                                        incidents (INSERT)                    │
│                                              │                               │
│                    ┌─────────────────────────┼────────────────────────┐      │
│                    │                         │                        │      │
│              Realtime CDC              pg_net HTTP POST          audit_log   │
│              → dashboard               → /api/pipeline/incident               │
│                                                                              │
│   pg_cron jobs: stale-ping sweeper (1m) · ping downsampler (10m) ·           │
│                 score recompute (5m) · retention purge (1h)                  │
│                                                                              │
│   Tables: tourists · digital_ids · zones · location_pings · location_tracks  │
│           itineraries · incidents · incident_events · responders ·           │
│           dispatches · notifications · efir_drafts · chain_anchors · audit_log│
│   Auth · Storage (PMTiles, photos, E-FIR PDFs) · RLS on every table          │
└───────────────┬──────────────────────────────────────────────────┬───────────┘
                │ (C) service-role queries                          │
                ▼                                                   │
┌──────────────────────────────────────────────────────────────────┴───────────┐
│              APPLICATION / ORCHESTRATION — Vercel (Node.js 24, Fluid)        │
│                                                                              │
│  /api/identity/issue      → mint soulbound DID, write chain_anchors          │
│  /api/identity/verify     → eth_call verify(tokenId) + VC signature check    │
│  /api/identity/revoke     → on-chain revoke + local status flip              │
│  /api/pipeline/incident   → enrich → score → dispatch → anchor               │
│  /api/ai/score            → proxy to HF Space, fallback onnxruntime-node     │
│  /api/ai/brief            → LLM incident summary (Groq → Gemini fallback)    │
│  /api/ai/efir             → LLM E-FIR draft → PDF → Storage → Resend         │
│  /api/ai/nl-query         → NL → parameterised SQL (allow-listed views)      │
│  /api/notify/dispatch     → fan-out: WebPush + Telegram + Email + Realtime   │
│  /api/health              → keep-alive target for GH Actions                 │
└──────┬───────────────────────┬───────────────────────┬───────────────────────┘
       │ (D)                   │ (E)                   │ (F)
       ▼                       ▼                       ▼
┌──────────────┐   ┌────────────────────────┐   ┌──────────────────────────────┐
│ POLYGON AMOY │   │  AI SERVICES           │   │  NOTIFICATION CHANNELS       │
│ chainId 80002│   │                        │   │                              │
│              │   │ HF Space (FastAPI)     │   │ Web Push (VAPID, W3C)        │
│ TouristIdentity│ │  • IsolationForest     │   │ Telegram Bot API             │
│   Registry.sol│  │  • DBSCAN stop-points  │   │ Resend (email + E-FIR PDF)   │
│ IncidentAnchor│  │  • feature extractor   │   │ Supabase Realtime broadcast  │
│   .sol        │  │ ONNX local fallback    │   │ [SMS adapter — interface only]│
│              │   │ Groq / Gemini (LLM)    │   │                              │
│ viem fallback│   │  via Vercel AI SDK v6  │   │                              │
│ RPC ×3       │   │                        │   │                              │
└──────────────┘   └────────────────────────┘   └──────────────────────────────┘
```

### Trust boundaries

| Boundary | Enforced by |
| --- | --- |
| Browser ↔ Postgres (path A) | **RLS**. A tourist JWT can `INSERT` only rows where `tourist_id = auth.uid()`, and can `SELECT` only their own pings/incidents. The anon key is public by design; RLS is the actual control. |
| Browser ↔ Vercel | Supabase JWT verified server-side on every privileged route. |
| Vercel ↔ Postgres | **Service-role key**, server-only env var, never in a client bundle. |
| Vercel ↔ Chain | Relayer private key in Vercel env. Tourist keys are HD-derived, never exported. |
| Anything ↔ PII | PII lives only in Postgres, encrypted at rest, referenced on-chain solely as `keccak256` commitments. |

---

## 2.2 Flow 1 — Digital ID issuance (tourist onboarding at a check-post)

```
 1. Sign-up: Indian traveller → Continue with DigiLocker on the landing
    page or Tourist login tab. In-app DigiLocker: mobile/PIN or Aadhaar
    OTP → allow issued documents → server parses eAadhaar XML, opens a
    tourist session if needed, and prefills /onboard. Typed Aadhaar /
    Voter ID / DL remain available. International visitor → passport.
        │
 2. POST /api/identity/issue   { kycType, kycNumber, name, nationality,
                                 emergencyContacts[], tripStart, tripEnd,
                                 itineraryGeoJSON }
        │
 3. Server-side validation (Zod) → reject malformed numbers, nationality /
    document mismatches, and expired trip windows.
        │
 4. Generate salt = randomBytes(32).
    kycCommitment = keccak256(abi.encodePacked(kycType, kycNumber, salt))
    itineraryHash = keccak256(canonicalJSON(itineraryGeoJSON))
        │
 5. INSERT tourists (PII, salt stored pgcrypto-encrypted)
    INSERT itineraries (planned LineString → PostGIS geography)
        │
 6. Derive the tourist's wallet:  m/44'/60'/0'/0/{tourist_index}
    (HD from ISSUER_MNEMONIC — the tourist never handles a key)
        │
 7. Relayer signs and sends:
       TouristIdentityRegistry.issue(
          to            = derivedAddress,
          kycCommitment = 0x…,
          itineraryHash = 0x…,
          validFrom     = tripStart,
          validUntil    = tripEnd + 24h grace,
          metadataURI   = "supabase://did/{uuid}.json"
       )
    → returns tokenId, txHash.  Token is SOULBOUND (ERC-5192 locked = true).
        │
 8. Build a W3C Verifiable Credential off-chain, signed with the issuer key
    (EIP-712 typed data). Store the VC JSON in Supabase Storage at a
    content-addressed path; its sha256 == the on-chain metadata digest.
        │
 9. INSERT digital_ids (tourist_id, token_id, chain_id, contract, tx_hash,
                        commitment, status='active')
    INSERT chain_anchors (kind='id_issue', tx_hash, block_number)
        │
10. Return to client: tokenId + a compact QR payload
       { chainId, contract, tokenId, vcCid, sig }
    The QR is the tourist's presentable credential.
        │
11. VERIFICATION (hotel / checkpoint / forest office scans the QR):
       GET /api/identity/verify?tokenId=…
         a. eth_call verify(tokenId) → { valid, status, validUntil, commitment }
         b. fetch VC, check EIP-712 signature against the on-chain issuer
         c. optional: prove KYC without revealing it — the holder supplies
            (kycNumber, salt); server recomputes the commitment and compares.
            The verifier learns only "matches / does not match".
       → green / amber / red card, plus revocation status, in one round trip.
```

**Why step 11c matters in the pitch:** that is a selective-disclosure proof. The hotel confirms the government issued this ID to this person without ever seeing the passport number, and without calling a central government API that might be down.

---

## 2.3 Flow 2 — The hot path: location ping → geofence → incident

This is the flow to walk the judges through, because it is the demo.

```
STEP 0  DEVICE
        navigator.geolocation.watchPosition({ enableHighAccuracy: true })
        Adaptive cadence: 5 s moving / 30 s stationary / 60 s battery-saver.
        Client-side Turf.js pre-check against a cached GeoJSON of nearby zones
        (refreshed every 5 min). If a breach is detected locally, the PWA shows
        an immediate in-app warning and vibrates — before the network round trip.
        Offline? The ping is queued in IndexedDB and flushed via Background Sync.
             │
STEP 1  INGEST  (path A — no serverless hop)
        supabase.from('location_pings').insert({
          tourist_id, geog: POINT(lon lat), accuracy_m, speed_mps,
          heading_deg, battery_pct, recorded_at, source: 'phone'|'band'|'sim'
        })
        RLS: WITH CHECK (tourist_id = auth.uid())
        Latency budget: ~80–150 ms.
             │
STEP 2  SPATIAL EVALUATION  (AFTER INSERT trigger → evaluate_position())
        All inside Postgres, single transaction, GiST-indexed:

          a. ZONE RESOLUTION
             SELECT z.* FROM zones z
             WHERE z.active AND ST_Contains(z.geom::geometry, NEW.geog::geometry)
             → current zone set + max risk_level

          b. TRANSITION DETECTION
             Compare against the previous ping's zone set:
               entered restricted/high_risk  → candidate incident
               exited  safe corridor         → candidate incident
               entered a zone outside its allowed time window → candidate

          c. ITINERARY ADHERENCE
             ST_Distance(itinerary.path, NEW.geog) > corridor_m
             → deviation_m recorded; sustained > 15 min ⇒ candidate

          d. KINEMATIC CHECKS
             speed > 150 km/h            ⇒ spoof/anomaly candidate
             displacement/Δt implausible ⇒ GPS jump, flag low-confidence
             zero movement > 45 min in a non-accommodation zone ⇒ candidate

          e. SILENCE CHECK (separate pg_cron job, every 60 s)
             tourists with last_ping_at < now() - interval '20 minutes'
             AND trip active ⇒ 'signal_lost' incident

          f. DEBOUNCE
             Suppress duplicates via a unique partial index on
             (tourist_id, type, zone_id) WHERE status IN ('open','ack')
             plus a 5-minute cooldown — prevents the classic
             "tourist standing on a zone border generates 400 alerts."
             │
STEP 3  INCIDENT CREATION
        INSERT incidents (tourist_id, type, severity, zone_id, geog,
                          detected_by='rules', payload jsonb, status='open')
        Severity from a matrix: zone.risk_level × incident type × time-of-day.
             │
        ├──► STEP 4a  REALTIME (instant, <100 ms)
        │    Postgres logical replication → Supabase Realtime → WebSocket
        │    → dashboard incident queue animates in, map pin pulses red,
        │      audible alert in the control room.
        │    → tourist's own channel receives the in-app warning.
        │
        └──► STEP 4b  pg_net async HTTP POST → /api/pipeline/incident
                      (fire-and-forget, does not block the insert txn)
             │
STEP 5  ENRICHMENT & AI  (Vercel Route Handler)
          a. Reverse geocode (Photon) → human-readable location.
          b. Fetch the last 60 min of pings → build the feature window.
          c. POST to HF Space /score → IsolationForest anomaly score 0–1.
             Cold start / 5xx? → onnxruntime-node local inference.
             Both unavailable? → rules-only score; incident still proceeds.
          d. Recompute the composite safety_score (0–100) for the tourist.
          e. If anomaly_score crosses the threshold, escalate severity and set
             detected_by='rules+ml'.
          f. Groq/Gemini generates a 2-sentence control-room brief and a
             tourist-language notification body.  LLM never gates the alert.
             │
STEP 6  DISPATCH  (/api/notify/dispatch, channel fan-out)
          a. Nearest-responder query:
             SELECT r.* FROM responders r
             WHERE r.on_duty
               AND ST_DWithin(r.last_geog, incident.geog, r.coverage_m)
             ORDER BY ST_Distance(r.last_geog, incident.geog) LIMIT 3
             ETA via OSRM (fallback: Haversine × 1.4).
          b. INSERT dispatches (incident_id, responder_id, eta_s, status='sent')
          c. Fan-out, each channel independent and retried:
               • Telegram → control-room group: incident card, static map
                 thumbnail, inline [Acknowledge] [Dispatch] [Resolve] buttons
               • Web Push → tourist device + assigned responder devices
               • Realtime → dashboard state change
               • Resend  → email to the district officer for severity ≥ high
          d. INSERT notifications rows for a full delivery audit trail.
             │
STEP 7  BLOCKCHAIN ANCHORING  (async, non-blocking)
        For severity >= 'high' or type = 'sos':
          IncidentAnchor.anchor(
             incidentId  = uuid → bytes16,
             recordHash  = keccak256(canonical incident record),
             touristToken= tokenId,
             occurredAt  = timestamp
          )
        → INSERT chain_anchors (kind='incident', tx_hash, block_number)
        The evidentiary record is now un-backdatable. Any later mutation of the
        incident row produces a hash mismatch, which the dashboard surfaces as
        a red "integrity broken" badge.
             │
STEP 8  RESPONSE LOOP
        Responder taps [Acknowledge] in Telegram → webhook → /api/dispatch/ack
        → dispatches.status='ack' → Realtime → dashboard timer starts
        → tourist PWA shows "Help dispatched · ETA 7 min · Officer Baruah"
        Every state change appends to incident_events (append-only) and
        audit_log, giving a complete, replayable timeline.
             │
STEP 9  CLOSURE
        Officer resolves → status='resolved' → resolution hash re-anchored
        → if type='missing_person', /api/ai/efir drafts the E-FIR from the
          structured record, renders a PDF, stores it, emails the police
          station, and anchors the PDF hash on-chain.
```

**Target end-to-end latency, panic button to control-room siren: under 2 seconds.** Ping insert ~120 ms, trigger ~5 ms, Realtime ~80 ms, Telegram ~400 ms. Time it live on stage; it is the most persuasive thing you can do.

---

## 2.4 Flow 3 — Panic / SOS (the shortest path, deliberately)

The SOS path bypasses every optional stage. Nothing that can fail is allowed between the button and the alert.

```
Tap & hold 1.5 s (prevents pocket-fires)
   → optimistic UI: "SENDING…" + haptic
   → INSERT incidents { type:'sos', severity:'critical', status:'open' }
        (direct client insert, RLS-guarded — no Route Handler in the path)
   → trigger fires immediately, skipping debounce for type='sos'
   → Realtime broadcast → dashboard full-screen takeover + alarm
   → pg_net → /api/notify/dispatch (Telegram + push + email, parallel)
   → PWA opens a WebRTC-free audio note recorder (optional, uploads to Storage)
   → device switches to 2 s ping cadence for the next 30 minutes
   → offline? Service Worker Background Sync retries the insert until it lands,
     and the PWA falls back to a pre-composed SMS intent (tel: / sms: URI) that
     the tourist can send with one tap on any network.
```

The offline SMS-intent fallback costs nothing, uses the phone's own SMS, and is a genuinely good answer to "what if there's no data connectivity in Arunachal?"

---

## 2.5 Flow 4 — Admin defines a geofence

```
Admin draws a polygon on MapLibre (Terra Draw)
  → GeoJSON Feature + { name, risk_level, category, time_windows[], radius }
  → Server Action validateAndSaveZone()
      • ST_IsValid / ST_MakeValid on the geometry
      • ST_Area sanity check (reject > 5,000 km² fat-finger draws)
      • overlap report against existing zones (ST_Overlaps)
  → INSERT zones (geom geography(Polygon,4326), GiST-indexed)
  → Realtime broadcast → every connected tourist PWA refreshes its cached
    local geofence set → client-side pre-check is immediately accurate
  → zone definition hash anchored on-chain (optional, for audit of who
    declared which area restricted and when)
```

---

## 2.6 Failure modes and degradation

| If this fails | System behaviour |
| --- | --- |
| HF Space cold/down | ONNX local inference in the Route Handler; else rules-only. Alerts still fire. |
| Groq and Gemini both down | Template-based incident brief. Alerts still fire. |
| Polygon RPC down | `viem` fallback transport rotates across 3 RPCs; if all fail, the anchor is queued in `chain_anchors` with `status='pending'` and a `pg_cron` retry drains it. Nothing in the safety path blocks on the chain. |
| Telegram down | Web Push + Realtime + email still deliver. |
| Tourist device offline | Local Turf.js geofence + IndexedDB queue + Background Sync + SMS-intent fallback. |
| Supabase project paused | GH Actions keep-alive prevents it; local Docker stack is the demo fallback. |
| Internet dies at the venue | `CHAIN_MODE=anvil-local`, `DB_MODE=supabase-local`, `AI_MODE=onnx-local`, `MAP_TILE_MODE=pmtiles-local`. Full demo, zero network. |

**Design principle to state explicitly:** the blockchain and the AI are *enhancements on the side of the safety path, never inside it*. A tourist in danger gets an alert even if every clever component is down. That single sentence answers half the hostile questions on this problem statement.
