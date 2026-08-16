# Offline demo — network cable unplugged

Rehearse this **once while online** (pull images, `pnpm install`). After that the laptop can pitch with Wi-Fi off.

## 0. One-time online prep (do this at the hotel, not on stage)

```bash
# Node 24 + pnpm
corepack enable && corepack prepare pnpm@10.15.1 --activate
pnpm install

# Docker images used by `supabase start` and Anvil
supabase start          # first run downloads Postgres 15 + Auth + Realtime
supabase stop
docker pull ghcr.io/foundry-rs/foundry:latest   # optional; local `anvil` is enough if Foundry is installed

# Optional richer basemap (~80 MB). Skip if you are fine with the bundled GeoJSON envelope.
# bash tools/seed-data/export-pmtiles.sh
```

Foundry (`anvil`, `forge`, `cast`) must already be on `PATH`.

## 1. Flip the four mode switches

In `.env` **and** `.env.local` (Next only reads `.env.local` for the app):

```bash
DB_MODE="supabase-local"
CHAIN_MODE="anvil-local"
AI_MODE="onnx-local"
NEXT_PUBLIC_MAP_TILE_MODE="pmtiles-local"
NOTIFY_CHANNELS="realtime,webpush"

LOCAL_SUPABASE_URL="http://127.0.0.1:54321"
LOCAL_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
LOCAL_RPC_URL="http://127.0.0.1:8545"
PIPELINE_URL="http://host.docker.internal:3000/api/pipeline/incident"
ANCHOR_RETRY_URL="http://host.docker.internal:3000/api/chain/retry"
PII_ENCRYPTION_KEY="dev-only-pii-key"
# Anvil account #0 — public test key, never a mainnet key
ISSUER_PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
ISSUER_ADDRESS="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
TOURIST_HD_MNEMONIC="test test test test test test test test test test test junk"
```

Leave cloud URLs in the file; `DB_MODE` / `CHAIN_MODE` make the app ignore them. Local JWT fallbacks are the well-known `supabase start` demo keys.

Then **unplug the network**.

## 2. Bring the stack up (cable out)

```bash
# Postgres 15 + PostGIS 3 + Auth + Realtime (cached images)
supabase start

# Local chain
anvil --chain-id 31337 --block-time 1 --host 127.0.0.1 --port 8545

# In another terminal — deploy both contracts onto Anvil
pnpm chain:deploy:anvil

# Known demo state in < 10 s
pnpm demo:reset

# Web app
pnpm --filter @sts/web dev
```

Verify modes:

```bash
curl -s http://127.0.0.1:3000/api/health | python3 -m json.tool
# expect: ok true, modes.db=supabase-local, modes.chain=anvil-local,
#         modes.ai=onnx-local, modes.map=pmtiles-local
```

Point Postgres `pg_net` at the laptop (once per `supabase db reset`):

```sql
alter database postgres set app.pipeline_url = 'http://host.docker.internal:3000/api/pipeline/incident';
alter database postgres set app.anchor_retry_url = 'http://host.docker.internal:3000/api/chain/retry';
alter database postgres set app.pipeline_secret = '<same as PIPELINE_SECRET>';
```

On macOS `host.docker.internal` reaches Next.js from the Supabase DB container. If that is missing, alerts still appear via Realtime; only AI brief / Telegram / anchoring skip.

## 3. Six-minute demo, still unplugged

1. `http://127.0.0.1:3000/login?tab=officer` → **Enter command centre** (`admin@demo.sts` / `DemoPass123!`).
2. Dashboard map uses the local GeoJSON envelope (and PMTiles if `apps/web/public/tiles/northeast.pmtiles` exists). OpenFreeMap is **not** contacted.
3. Second browser / phone on the same LAN: tourist tab → **Enter as Priya Sharma**.
4. Simulator (optional, still local):

```bash
pnpm sim -- --scenario zone-breach --tourists 8 --speed 8x --duration 90s
```

5. Hold SOS on `/sos`. Queue announces a **critical** incident (text + `!!` mark, not colour alone).
6. `/verify`: paste the token from `/onboard` (or the tourist ID card). Chain calls go to Anvil, not Amoy.

Between judging slots:

```bash
pnpm demo:reset
```

## What each local value actually does

| Switch | Local value | What runs |
| --- | --- | --- |
| `DB_MODE` | `supabase-local` | `http://127.0.0.1:54321` + well-known anon/service JWTs. Direct Postgres via `LOCAL_DATABASE_URL`. |
| `CHAIN_MODE` | `anvil-local` | viem → `LOCAL_RPC_URL`. Zero issuer key is replaced with Anvil account #0. Addresses read from `packages/contracts/deployments/anvil.json`. |
| `AI_MODE` | `onnx-local` | `onnxruntime-node` + `services/ai/artifacts/iforest.onnx`. LLM calls short-circuit to the rules templates. HF / Groq / Gemini are not contacted. |
| `NEXT_PUBLIC_MAP_TILE_MODE` | `pmtiles-local` | `pmtiles://` if the extract exists; **always** falls back to `/offline/northeast-outline.geojson` + `/offline/zones.geojson` with **no remote glyphs**. |

`CHAIN_MODE=disabled` is the last-resort chain switch: identity issue writes the DB mirror and returns `pending`.

## What will not work with the cable out

These are the honest gaps — none of them sit on the alert path:

| Dependency | Offline behaviour |
| --- | --- |
| Telegram Bot API | Channel skipped. `NOTIFY_CHANNELS=realtime,webpush`. |
| Resend email | Channel skipped. |
| Groq / Gemini | `AI_MODE=onnx-local` uses IsolationForest + rules briefs. |
| Hugging Face Space | Skipped; ONNX then rules. |
| OpenFreeMap / Photon / Nominatim / OSRM | Map uses local GeoJSON. Reverse geocode uses zone names from `/offline/zones.geojson`, then a coordinate label. ETA falls back to Haversine × 1.4 in dispatch. |
| Polygon Amoy + Polygonscan | Anvil. No explorer links. |
| First `docker pull` / `pnpm install` | Must happen **before** unplugging. |
| `northeast.pmtiles` (~80 MB) | Not in git (`.gitignore`). Without the extract the map is the NE envelope + seeded zones — enough to pitch. |
| Web Push delivery | VAPID still signs locally; the browser cannot reach a push service if the WAN is dead. In-app Realtime + the ARIA live region still announce. |
| `pg_net` → Next.js | Needs `host.docker.internal`. If it fails, the incident is **already in Postgres** and Realtime still paints the queue. |

## Sanity checklist (60 seconds)

```bash
curl -sf http://127.0.0.1:54321/rest/v1/zones?select=id -H "apikey: $LOCAL_ANON" >/dev/null
cast block-number --rpc-url http://127.0.0.1:8545
curl -sf http://127.0.0.1:3000/api/health
pnpm demo:reset
```
