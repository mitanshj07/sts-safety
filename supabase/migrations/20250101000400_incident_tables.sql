-- supabase/migrations/20250101000400_incident_tables.sql
-- Smart Tourist Safety — incidents, response, notifications.

create table if not exists incidents (
  id                uuid              primary key default gen_random_uuid(),
  tourist_id        uuid              references tourists(id) on delete set null,
  type              incident_type     not null,
  severity          severity_level    not null default 'medium',
  status            incident_status   not null default 'open',
  detected_by       detection_source  not null default 'rules',

  geog              geography(Point, 4326),
  zone_id           uuid              references zones(id) on delete set null,
  address_text      text,                            -- reverse-geocoded, cached

  anomaly_score     real check (anomaly_score between 0 and 1),
  safety_score_at   smallint,
  payload           jsonb             not null default '{}'::jsonb,
    -- rule-specific evidence: { deviation_m, silence_minutes, speed_kmh, window_features }
  ai_brief          text,                            -- LLM-generated control-room summary
  ai_brief_model    text,

  occurred_at       timestamptz       not null default now(),
  acknowledged_at   timestamptz,
  resolved_at       timestamptz,
  resolution_notes  text,
  resolved_by       uuid              references profiles(id),

  record_hash       text,                            -- keccak256 of the canonical record
  created_at        timestamptz       not null default now(),
  updated_at        timestamptz       not null default now()
);

-- Debounce: at most one OPEN incident of a given type per tourist per zone.
-- This single index prevents the "tourist standing on a border generates
-- 400 identical alerts" failure that ruins live demos.
-- Expression unique index: ON CONFLICT must name the same expression.
create unique index if not exists incidents_open_dedupe
  on incidents (tourist_id, type, (coalesce(zone_id, '00000000-0000-0000-0000-000000000000'::uuid)))
  where status in ('open', 'acknowledged', 'dispatched');

-- Append-only timeline. Never UPDATE or DELETE rows here.
create table if not exists incident_events (
  id            bigserial   primary key,
  incident_id   uuid        not null references incidents(id) on delete cascade,
  event_type    text        not null,   -- created | ack | dispatched | note | escalated | resolved | anchored
  actor_id      uuid        references profiles(id),
  actor_label   text,
  detail        jsonb       not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create table if not exists responders (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid references profiles(id) on delete set null,
  name           text        not null,
  unit_type      text        not null,   -- tourist_police | police_station | medical | forest | ndrf
  station_name   text,
  phone_e164     text,
  telegram_chat_id text,
  base_geog      geography(Point, 4326) not null,
  last_geog      geography(Point, 4326),
  last_seen_at   timestamptz,
  coverage_m     integer     not null default 15000,
  on_duty        boolean     not null default true,
  state_code     text,
  district       text,
  created_at     timestamptz not null default now()
);

create table if not exists dispatches (
  id            uuid            primary key default gen_random_uuid(),
  incident_id   uuid            not null references incidents(id) on delete cascade,
  responder_id  uuid            not null references responders(id) on delete cascade,
  status        dispatch_status not null default 'sent',
  distance_m    double precision,
  eta_seconds   integer,
  sent_at       timestamptz     not null default now(),
  acknowledged_at timestamptz,
  arrived_at    timestamptz,
  completed_at  timestamptz,
  notes         text,
  unique (incident_id, responder_id)
);

create table if not exists notifications (
  id            bigserial      primary key,
  incident_id   uuid           references incidents(id) on delete cascade,
  recipient_kind text          not null,   -- tourist | responder | authority | emergency_contact
  recipient_id  uuid,
  channel       notify_channel not null,
  status        notify_status  not null default 'queued',
  title         text,
  body          text,
  locale        text default 'en',
  provider_ref  text,                      -- message id / endpoint
  error         text,
  attempts      smallint       not null default 0,
  created_at    timestamptz    not null default now(),
  delivered_at  timestamptz
);

-- Web Push (VAPID) subscriptions
create table if not exists push_subscriptions (
  id           bigserial   primary key,
  profile_id   uuid        not null references profiles(id) on delete cascade,
  endpoint     text        not null unique,
  p256dh       text        not null,
  auth         text        not null,
  user_agent   text,
  created_at   timestamptz not null default now()
);

create table if not exists efir_drafts (
  id            uuid        primary key default gen_random_uuid(),
  incident_id   uuid        not null references incidents(id) on delete cascade,
  tourist_id    uuid        references tourists(id) on delete set null,
  station_name  text,
  narrative     text        not null,      -- LLM-drafted, human-editable
  structured    jsonb       not null default '{}'::jsonb,
  pdf_path      text,                      -- Supabase Storage key
  pdf_sha256    text,
  approved_by   uuid        references profiles(id),
  approved_at   timestamptz,
  created_at    timestamptz not null default now()
);
