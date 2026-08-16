-- supabase/migrations/20250101001300_pipeline_ai.sql
-- Reverse-geocode cache (100 m geohash) + read-only NL→SQL role.

create table if not exists geocode_cache (
  geohash       text primary key,          -- geohash precision 7 ≈ 153 m (100 m cell)
  lat           double precision not null,
  lon           double precision not null,
  address_text  text        not null,
  provider      text        not null default 'photon',
  created_at    timestamptz not null default now()
);

comment on table geocode_cache is
  'Photon/Nominatim reverse-geocode cache keyed by ~100 m geohash. Never hit the free service twice for the same cell.';

alter table geocode_cache enable row level security;

drop policy if exists geocode_staff_read on geocode_cache;
create policy geocode_staff_read on geocode_cache
  for select using (app.is_staff());

-- Service role bypasses RLS (pipeline writes). Authenticated staff may read.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'nl_reader') then
    create role nl_reader nologin nosuperuser nocreatedb nocreaterole;
  end if;
exception when insufficient_privilege then
  raise notice 'cannot create nl_reader: %', sqlerrm;
end;
$$;

do $$
begin
  grant usage on schema public to nl_reader;
  grant select on v_live_tourists, v_open_incidents, v_zone_risk_ranking to nl_reader;
  -- Connecting role (postgres / supabase) must be a member to SET ROLE.
  grant nl_reader to postgres;
exception when others then
  raise notice 'nl_reader grants skipped: %', sqlerrm;
end;
$$;
