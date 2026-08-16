-- supabase/migrations/20250101000900_rls.sql
-- Smart Tourist Safety — Row Level Security on every table + Realtime publication.

-- Explicit grants: CLI 2.x no longer auto-exposes new public tables to Data API roles.
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;

alter table profiles           enable row level security;
alter table tourists           enable row level security;
alter table digital_ids        enable row level security;
alter table zones              enable row level security;
alter table itineraries        enable row level security;
alter table location_pings     enable row level security;
alter table location_tracks    enable row level security;
alter table incidents          enable row level security;
alter table incident_events    enable row level security;
alter table responders         enable row level security;
alter table dispatches         enable row level security;
alter table notifications      enable row level security;
alter table push_subscriptions enable row level security;
alter table efir_drafts        enable row level security;
alter table chain_anchors      enable row level security;
alter table audit_log          enable row level security;

-- Recreate policies so `db reset` (and a defensive re-apply) stays idempotent.
drop policy if exists profiles_self_read        on profiles;
drop policy if exists profiles_self_write       on profiles;
drop policy if exists tourists_self             on tourists;
drop policy if exists tourists_self_update      on tourists;
drop policy if exists tourists_admin_all        on tourists;
drop policy if exists zones_public_read         on zones;
drop policy if exists zones_admin_write         on zones;
drop policy if exists pings_insert_own          on location_pings;
drop policy if exists pings_read_own            on location_pings;
drop policy if exists tracks_read               on location_tracks;
drop policy if exists itin_own                  on itineraries;
drop policy if exists incidents_insert_own      on incidents;
drop policy if exists incidents_read            on incidents;
drop policy if exists incidents_staff_write     on incidents;
drop policy if exists incident_events_read      on incident_events;
drop policy if exists responders_read           on responders;
drop policy if exists dispatches_staff          on dispatches;
drop policy if exists notifications_read        on notifications;
drop policy if exists push_own                  on push_subscriptions;
drop policy if exists efir_staff                on efir_drafts;
drop policy if exists anchors_public_read       on chain_anchors;
drop policy if exists audit_auditor             on audit_log;
drop policy if exists digital_ids_public_read   on digital_ids;
drop policy if exists digital_ids_admin_write   on digital_ids;

-- Profiles
create policy profiles_self_read   on profiles for select using (id = auth.uid() or app.is_staff());
create policy profiles_self_write  on profiles for update using (id = auth.uid());

-- Tourists: own row, or staff
create policy tourists_self        on tourists for select using (profile_id = auth.uid() or app.is_staff());
create policy tourists_self_update on tourists for update using (profile_id = auth.uid());
create policy tourists_admin_all   on tourists for all    using (app.my_role() = 'admin');

-- Zones are public read (the tourist app needs them for local geofencing)
create policy zones_public_read    on zones for select using (active);
create policy zones_admin_write    on zones for all    using (app.my_role() = 'admin');

-- Pings: a tourist may INSERT only their own; may read only their own.
create policy pings_insert_own on location_pings for insert
  with check (tourist_id = app.my_tourist_id());
create policy pings_read_own   on location_pings for select
  using (tourist_id = app.my_tourist_id() or app.is_staff());

create policy tracks_read on location_tracks for select
  using (tourist_id = app.my_tourist_id() or app.is_staff());

create policy itin_own on itineraries for all
  using (tourist_id = app.my_tourist_id() or app.is_staff());

-- Incidents: a tourist can raise an SOS for themselves and read their own.
create policy incidents_insert_own on incidents for insert
  with check (tourist_id = app.my_tourist_id());
create policy incidents_read on incidents for select
  using (tourist_id = app.my_tourist_id() or app.is_staff());
create policy incidents_staff_write on incidents for update
  using (app.is_staff());

create policy incident_events_read on incident_events for select
  using (app.is_staff() or exists (
    select 1 from incidents i where i.id = incident_id and i.tourist_id = app.my_tourist_id()));

create policy responders_read      on responders   for select using (app.is_staff());
create policy dispatches_staff     on dispatches   for all    using (app.is_staff());
create policy notifications_read   on notifications for select using (app.is_staff());
create policy push_own             on push_subscriptions for all using (profile_id = auth.uid());
create policy efir_staff           on efir_drafts  for all    using (app.is_staff());
create policy anchors_public_read  on chain_anchors for select using (true);
create policy audit_auditor        on audit_log    for select using (app.my_role() in ('admin','auditor'));

-- Digital IDs are publicly readable by token (verification is meant to be open);
-- they contain only commitments and status, never PII.
create policy digital_ids_public_read on digital_ids for select using (true);
create policy digital_ids_admin_write on digital_ids for all
  using (app.my_role() = 'admin');

-- Realtime publication (exists in the local/cloud Supabase cluster).
do $$
begin
  alter publication supabase_realtime add table incidents;
exception
  when duplicate_object then null;
  when undefined_object then
    raise notice 'publication supabase_realtime not present';
end;
$$;

do $$
begin
  alter publication supabase_realtime add table incident_events;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table dispatches;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table tourists;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table zones;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;

-- Realtime needs full row images to compute meaningful payloads on UPDATE
alter table incidents  replica identity full;
alter table dispatches replica identity full;
alter table tourists   replica identity full;
