# 5. Environment Variables

The authoritative, copy-pasteable template is **`.env.example`** at the repository root. This page explains how to obtain each credential and which ones are safe to expose.

## Setup order

```bash
cp .env.example .env.local          # apps/web
cp .env.example .env                # tooling: foundry, simulator, supabase cli
```

## Where each credential comes from

| Group | How to get it | Card required |
| --- | --- | --- |
| Supabase (`NEXT_PUBLIC_SUPABASE_URL`, anon key, service role) | Create a project at supabase.com → Project Settings → API | No |
| `DATABASE_URL` | Supabase → Project Settings → Database → Connection string (URI) | No |
| `PII_ENCRYPTION_KEY` | `openssl rand -base64 32` | — |
| `PIPELINE_SECRET` | `openssl rand -hex 32`, then set it inside Postgres with `alter database postgres set app.pipeline_secret = '…'` | — |
| `ISSUER_PRIVATE_KEY` / `ISSUER_ADDRESS` | `cast wallet new`. **Testnet only.** Fund with Amoy POL from faucet.polygon.technology | No |
| `TOURIST_HD_MNEMONIC` | `cast wallet new-mnemonic` | — |
| RPC URLs | Already filled in. Keyless public endpoints — no signup | No |
| `POLYGONSCAN_API_KEY` | polygonscan.com → sign up → My API Keys | No |
| `GROQ_API_KEY` | console.groq.com/keys | No |
| `GOOGLE_GENERATIVE_AI_API_KEY` | aistudio.google.com/apikey | No |
| `HF_SPACE_URL` | huggingface.co → New Space → Docker → free CPU Basic | No |
| VAPID keys | `npx web-push generate-vapid-keys` | — |
| `TELEGRAM_BOT_TOKEN` | Message @BotFather on Telegram → `/newbot` | No |
| `TELEGRAM_CONTROL_ROOM_CHAT_ID` | Add the bot to a group, then `getUpdates` and read `chat.id` (negative number) | No |
| `RESEND_API_KEY` | resend.com → API Keys. Use `onboarding@resend.dev` as the sender until you have a domain | No |
| Map, geocoding, routing URLs | Pre-filled. All keyless | No |
| DigiLocker (`DIGILOCKER_CLIENT_ID` / `SECRET`) | partners.digitallocker.gov.in → register a requester app. Redirect URI **must** be `https://sts-safety.vercel.app/api/identity/digilocker/callback` (or `{APP_URL}/api/identity/digilocker/callback` locally). Production `DIGILOCKER_MODE=live` — without these two secrets the DigiLocker button returns a config error instead of a fake profile. Set `DIGILOCKER_MODE=demo` only for offline / e2e. | No |

## Exposure rules

`NEXT_PUBLIC_*` is compiled into the browser bundle and is world-readable. Only these belong there: the Supabase URL and **anon** key (safe by design — RLS is the actual access control), the chain id and contract addresses (public on chain anyway), the VAPID **public** key, and map style URLs.

Everything else is server-only. In particular, `SUPABASE_SERVICE_ROLE_KEY`, `ISSUER_PRIVATE_KEY`, `TOURIST_HD_MNEMONIC`, `PII_ENCRYPTION_KEY`, `PIPELINE_SECRET`, and `DIGILOCKER_CLIENT_SECRET` bypass all security if leaked. Import `server-only` at the top of any module that reads them so a stray client import fails at build time rather than silently shipping the secret.

## The demo switches

Demo switches control whether the system talks to the internet at all. Set them to their local values and the entire product runs on a laptop with no network:

| Variable | Cloud value | Offline value |
| --- | --- | --- |
| `DB_MODE` | `supabase-cloud` | `supabase-local` |
| `CHAIN_MODE` | `amoy` | `anvil-local` |
| `AI_MODE` | `groq` | `onnx-local` (or `rules-only`) |
| `NEXT_PUBLIC_MAP_TILE_MODE` | `openfreemap` | `pmtiles-local` |
| `NOTIFY_CHANNELS` | `realtime,webpush,telegram,email` | `realtime,webpush` |
| `DIGILOCKER_MODE` | `live` (with partner credentials) | `demo` (in-app consent, no MeitY call) |

Rehearse at least once in the offline column.

## Verification

`pnpm check:freetier` fails the build if any variable matching `STRIPE|TWILIO|MAPBOX|AWS_|GOOGLE_MAPS` is set — a guard against accidentally introducing a paid dependency and breaching the hackathon constraint.
