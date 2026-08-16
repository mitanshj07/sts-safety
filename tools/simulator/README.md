# tools/simulator/README.md

CLI that drives the live SIH demo: 25 tourists walking real North-East corridors, pings inserted **as each tourist** (JWT + RLS), geofencing left in Postgres.

```bash
pnpm sim --tourists 25 --scenario zone-breach --speed 5x --seed 2025
```

## Flags

| Flag | Default | Notes |
| --- | --- | --- |
| `--tourists` | `SIM_TOURIST_COUNT` (25) | First five map to seeded demo logins |
| `--scenario` | `SIM_SCENARIO` | `normal-trek` `zone-breach` `signal-loss` `route-deviation` `panic-sos` `stationary-anomaly` |
| `--speed` | `SIM_SPEED_MULTIPLIER` | `5x` / `5` — wall clock only; `recorded_at` follows simulated time so PostGIS speed checks stay realistic |
| `--seed` | `2025` | Mulberry32 — same seed ⇒ byte-identical recordings |
| `--duration` | scenario-specific | `10m`, `600s`, `15m` |
| `--tick-ms` | `SIM_TICK_MS` (1000) | Simulated step |
| `--record` | `tools/simulator/recordings/<scenario>-seed<seed>.json` | Written at the end (and on Ctrl+C) |
| `--replay <file>` | — | Re-emits a recording deterministically |
| `--offline` | off | Engine + console + recording, no Supabase |

Copy `.env.example` → `.env`. `DB_MODE=supabase-local` uses `LOCAL_SUPABASE_*`. Ping inserts never use the service role; that key is only for provisioning extra `simNN@demo.sts` users and resetting leftover incidents.

Demo password (from `supabase/seed/03_demo_tourists.sql`): `DemoPass123!`

## Scenarios

- **normal-trek** — Shillong→Sohra plus highway background. Restricted / high_risk / border polygons are never entered. Judges' false-positive test.
- **zone-breach** — Kenji Nakamura walks from NH-37 into **Kaziranga Core Range**. Countdown is printed on the second screen. He halts inside the core so the unique-open-incident index keeps the count at one.
- **signal-loss** — pings stop for 25 simulated minutes. `pg_cron` `sts-signal-loss` fires after `SIGNAL_LOST_MINUTES` of wall-clock silence (`last_ping_at` is sim-time, so use `--speed 1x` if you need the sweeper during a short pitch).
- **route-deviation** — 3 km perpendicular drift off the Guwahati→Shillong corridor (seeded corridor is 2 km).
- **panic-sos** — tourist JWT inserts `incidents.type = sos`.
- **stationary-anomaly** — motionless 50 min on NH-6 at 02:00 IST. Sweeper uses wall-clock `now()`; same 1x note as signal-loss.

## Synthetic training set (Phase 9)

```bash
pnpm sim:generate
```

Writes `tools/seed-data/out/trajectories.csv` and `labels.json`: 5,000 normal windows + 500 anomalous, 18-feature vectors in `FEATURE_NAMES` (`packages/shared/src/constants/feature-vector.ts`).

## Verify

```bash
pnpm sim --scenario zone-breach --offline --seed 2025
pnpm sim --scenario normal-trek --offline --duration 10m --seed 2025
```

Offline checks the local polygon engine (same rings as `01_zones_northeast.sql`). Against a live DB, the same commands without `--offline` should create **exactly one** `geofence_entry_restricted` incident and **zero** incidents respectively.
