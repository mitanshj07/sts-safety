#!/usr/bin/env bash
# tools/scripts/demo-reset.sh
# Truncate operational tables and restore seeded zones / tourists / responders.
# Target: < 10 seconds between judging slots.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

DB_MODE="${DB_MODE:-supabase-cloud}"
if [[ "$DB_MODE" == "supabase-local" ]]; then
  DATABASE_URL="${LOCAL_DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL (or LOCAL_DATABASE_URL with DB_MODE=supabase-local) is required" >&2
  exit 1
fi

PSQL=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q)
if ! command -v psql >/dev/null 2>&1; then
  if command -v docker >/dev/null 2>&1; then
    PSQL=(docker exec -i supabase_db_smart-tourist-safety psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
  else
    echo "psql not found. Install libpq or run supabase start so the db container exists." >&2
    exit 1
  fi
fi

echo ">> truncating incidents, dispatches, notifications, pings"
"${PSQL[@]}" <<'SQL'
BEGIN;

truncate table
  location_pings,
  location_tracks,
  incident_events,
  dispatches,
  notifications,
  efir_drafts,
  incidents,
  chain_anchors,
  audit_log,
  geocode_cache,
  digital_ids
restart identity cascade;

-- Drop operator-drawn zones that are not in the seed id range; seeds re-upsert next.
delete from zones
 where id not in (
   '11111111-1111-4111-8111-111111111101',
   '11111111-1111-4111-8111-111111111102',
   '11111111-1111-4111-8111-111111111103',
   '11111111-1111-4111-8111-111111111104',
   '11111111-1111-4111-8111-111111111105',
   '11111111-1111-4111-8111-111111111106',
   '11111111-1111-4111-8111-111111111107',
   '11111111-1111-4111-8111-111111111108',
   '11111111-1111-4111-8111-111111111109',
   '11111111-1111-4111-8111-111111111110',
   '11111111-1111-4111-8111-111111111111',
   '11111111-1111-4111-8111-111111111112',
   '11111111-1111-4111-8111-111111111113',
   '11111111-1111-4111-8111-111111111114'
 );

update tourists
   set safety_score = 100,
       status = 'active',
       last_geog = null,
       last_ping_at = null,
       current_zone_ids = '{}',
       updated_at = now()
 where id in (
   '22222222-2222-4222-8222-222222222201',
   '22222222-2222-4222-8222-222222222202',
   '22222222-2222-4222-8222-222222222203',
   '22222222-2222-4222-8222-222222222204',
   '22222222-2222-4222-8222-222222222205'
 );

COMMIT;
SQL

echo ">> restoring seeded zones, responders, tourists, staff"
"${PSQL[@]}" -f "$ROOT/supabase/seed/01_zones_northeast.sql"
"${PSQL[@]}" -f "$ROOT/supabase/seed/02_responders.sql"
"${PSQL[@]}" -f "$ROOT/supabase/seed/03_demo_tourists.sql"
"${PSQL[@]}" -f "$ROOT/supabase/seed/04_demo_staff.sql"

echo "demo reset complete"
