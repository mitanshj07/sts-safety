-- AI hotspot suggestions: clusters of SOS / high-volume alerts from similar GPS
-- across distinct tourists, proposed as reserved geofences.

do $$ begin
  create type suggestion_status as enum ('open', 'accepted', 'dismissed');
exception when duplicate_object then null;
end $$;

create table if not exists ai_zone_suggestions (
  id                  uuid primary key default gen_random_uuid(),
  cluster_key         text not null,
  status              suggestion_status not null default 'open',
  centroid_lat        double precision not null,
  centroid_lon        double precision not null,
  radius_m            integer not null,
  incident_count      integer not null,
  unique_tourists     integer not null,
  sos_count           integer not null default 0,
  dominant_type       incident_type not null default 'sos',
  type_counts         jsonb not null default '{}'::jsonb,
  incident_ids        uuid[] not null default '{}',
  tourist_ids         uuid[] not null default '{}',
  proposed_name       text not null,
  proposed_category   zone_category not null default 'restricted',
  proposed_risk       risk_level not null default 'high',
  proposed_geom       jsonb not null,
  address_text        text,
  covering_zone_id    uuid references zones(id) on delete set null,
  covering_zone_name  text,
  rationale           text not null,
  rationale_model     text,
  window_hours        integer not null default 48,
  score               integer not null default 0,
  first_at            timestamptz,
  last_at             timestamptz,
  zone_id             uuid references zones(id) on delete set null,
  decided_by          uuid references profiles(id) on delete set null,
  decided_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index if not exists ai_zone_suggestions_open_key
  on ai_zone_suggestions (cluster_key)
  where status = 'open';

create index if not exists ai_zone_suggestions_status_score
  on ai_zone_suggestions (status, score desc, updated_at desc);

grant select, insert, update, delete on ai_zone_suggestions to anon, authenticated, service_role;

alter table ai_zone_suggestions enable row level security;

drop policy if exists ai_suggestions_staff_read on ai_zone_suggestions;
drop policy if exists ai_suggestions_staff_write on ai_zone_suggestions;

create policy ai_suggestions_staff_read on ai_zone_suggestions
  for select using (app.is_staff());

create policy ai_suggestions_staff_write on ai_zone_suggestions
  for all using (app.my_role() in ('admin', 'responder'));
