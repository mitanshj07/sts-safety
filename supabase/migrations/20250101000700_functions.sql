-- supabase/migrations/20250101000700_functions.sql
-- Smart Tourist Safety — geofencing engine (PL/pgSQL + PostGIS).
-- Lives in schema app. The safety path never depends on chain / LLM / ML.

-- Resolve which zones contain a point, honouring per-zone time windows.
-- Overnight windows (from > to, e.g. 18:00–06:00) wrap midnight.
create or replace function app.zones_at(p_geog geography, p_at timestamptz default now())
returns table (zone_id uuid, category zone_category, risk risk_level, name text)
language sql
stable
set search_path to public, extensions, app, pg_temp
as $$
  select z.id,
         z.category,
         coalesce(
           (select (w->>'risk_level')::risk_level
              from jsonb_array_elements(z.time_windows) w
             where (extract(dow from p_at at time zone 'Asia/Kolkata')::int)
                     = any (select jsonb_array_elements_text(w->'days')::int)
               and (
                     -- same-day window: from <= to
                     ((w->>'from')::time <= (w->>'to')::time
                      and (p_at at time zone 'Asia/Kolkata')::time
                            between (w->>'from')::time and (w->>'to')::time)
                     or
                     -- overnight window: from > to (e.g. 18:00–06:00)
                     ((w->>'from')::time > (w->>'to')::time
                      and ((p_at at time zone 'Asia/Kolkata')::time >= (w->>'from')::time
                           or (p_at at time zone 'Asia/Kolkata')::time <= (w->>'to')::time))
                   )
             limit 1),
           z.risk_level
         ) as risk,
         z.name
    from zones z
   where z.active
     and ST_Intersects(z.geom, p_geog);
$$;

-- Severity matrix: zone risk × incident type × time of day
-- STABLE (not IMMUTABLE): AT TIME ZONE depends on the timezone database.
create or replace function app.derive_severity(
  p_type incident_type, p_risk risk_level, p_at timestamptz
) returns severity_level
language plpgsql
stable
set search_path to public, extensions, app, pg_temp
as $$
declare
  hour_ist int := extract(hour from p_at at time zone 'Asia/Kolkata');
  night    boolean := hour_ist >= 20 or hour_ist < 5;
  base     severity_level;
begin
  base := case p_type
    when 'sos'                       then 'critical'
    when 'geofence_entry_restricted' then 'high'
    when 'signal_lost'               then 'high'
    when 'route_deviation'           then 'medium'
    when 'prolonged_inactivity'      then 'medium'
    when 'zone_time_violation'       then 'medium'
    when 'implausible_speed'         then 'low'
    when 'geofence_exit_safe'        then 'low'
    when 'battery_critical'          then 'low'
    else 'medium'
  end;

  if p_risk in ('high', 'critical') and base <> 'critical' then
    base := case base when 'low' then 'medium' when 'medium' then 'high' else 'high' end;
  end if;

  if night and base = 'medium' then base := 'high'; end if;

  return base;
end;
$$;

-- Raise an incident, honouring the dedupe index and a cooldown.
create or replace function app.raise_incident(
  p_tourist_id uuid,
  p_type       incident_type,
  p_geog       geography,
  p_zone_id    uuid,
  p_risk       risk_level,
  p_payload    jsonb default '{}'::jsonb,
  p_at         timestamptz default now()
) returns uuid
language plpgsql
security definer
set search_path to public, extensions, app, pg_temp
as $$
declare
  v_id       uuid;
  v_severity severity_level;
begin
  -- 5-minute cooldown on the same (tourist, type, zone) even after resolution
  if exists (
    select 1 from incidents
     where tourist_id = p_tourist_id
       and type = p_type
       and coalesce(zone_id, '00000000-0000-0000-0000-000000000000'::uuid)
           = coalesce(p_zone_id, '00000000-0000-0000-0000-000000000000'::uuid)
       and occurred_at > p_at - interval '5 minutes'
  ) then
    return null;
  end if;

  v_severity := app.derive_severity(p_type, coalesce(p_risk, 'low'::risk_level), p_at);

  insert into incidents (tourist_id, type, severity, geog, zone_id,
                         payload, occurred_at, safety_score_at)
  values (p_tourist_id, p_type, v_severity, p_geog, p_zone_id, p_payload, p_at,
          (select safety_score from tourists where id = p_tourist_id))
  on conflict (tourist_id, type, (coalesce(zone_id, '00000000-0000-0000-0000-000000000000'::uuid)))
    where status in ('open', 'acknowledged', 'dispatched')
  do nothing
  returning id into v_id;

  if v_id is not null then
    insert into incident_events (incident_id, event_type, actor_label, detail)
    values (v_id, 'created', 'geofence-engine', p_payload);
  end if;

  return v_id;
end;
$$;

-- Composite, explainable safety score (0–100).
create or replace function app.compute_safety_score(p_tourist_id uuid)
returns smallint
language plpgsql
stable
set search_path to public, extensions, app, pg_temp
as $$
declare
  s              int := 100;
  v_risk         risk_level;
  v_dev_m        double precision;
  v_silence_min  double precision;
  v_open_high    int;
  v_anomaly      real;
  v_hour         int;
begin
  select max(risk) into v_risk
    from app.zones_at((select last_geog from tourists where id = p_tourist_id));

  s := s - case v_risk
             when 'critical' then 40 when 'high' then 25
             when 'medium' then 12  when 'low' then 4 else 0 end;

  select ST_Distance(i.path, t.last_geog) - i.corridor_m
    into v_dev_m
    from itineraries i join tourists t on t.id = i.tourist_id
   where i.tourist_id = p_tourist_id and i.active
     and t.last_geog is not null
   order by i.starts_at desc limit 1;
  if v_dev_m > 0 then
    s := s - least(20, (v_dev_m / 500)::int * 5);
  end if;

  select extract(epoch from (now() - last_ping_at)) / 60
    into v_silence_min from tourists where id = p_tourist_id;
  if v_silence_min is not null and v_silence_min > 15 then
    s := s - least(25, ((v_silence_min - 15) / 5)::int * 5);
  end if;

  select count(*)::int into v_open_high
    from incidents
   where tourist_id = p_tourist_id
     and status in ('open','acknowledged','dispatched')
     and severity in ('high','critical');
  s := s - least(30, v_open_high * 15);

  select max(anomaly_score) into v_anomaly
    from incidents
   where tourist_id = p_tourist_id and occurred_at > now() - interval '30 minutes';
  if v_anomaly is not null then
    s := s - (v_anomaly * 20)::int;
  end if;

  -- night-time in a non-accommodation zone
  -- BUGFIX: BETWEEN 22 AND 4 is always false; use OR like derive_severity.
  v_hour := extract(hour from now() at time zone 'Asia/Kolkata');
  if (v_hour >= 22 or v_hour < 5)
     and not exists (select 1 from app.zones_at((select last_geog from tourists where id = p_tourist_id))
                      where category = 'accommodation') then
    s := s - 5;
  end if;

  return greatest(0, least(100, s))::smallint;
end;
$$;

-- Nearest available responders for an incident.
create or replace function app.nearest_responders(p_geog geography, p_limit int default 3)
returns table (responder_id uuid, name text, distance_m double precision, telegram_chat_id text)
language sql
stable
set search_path to public, extensions, app, pg_temp
as $$
  select r.id, r.name,
         ST_Distance(coalesce(r.last_geog, r.base_geog), p_geog) as distance_m,
         r.telegram_chat_id
    from responders r
   where r.on_duty
     and p_geog is not null
     and ST_DWithin(coalesce(r.last_geog, r.base_geog), p_geog, r.coverage_m)
   order by distance_m asc
   limit p_limit;
$$;

-- THE HOT PATH: evaluate a position and raise incidents.
create or replace function app.evaluate_position()
returns trigger
language plpgsql
security definer
set search_path to public, extensions, app, pg_temp
as $$
declare
  v_prev_zones   uuid[];
  v_curr         record;
  v_curr_ids     uuid[] := '{}';
  v_max_risk     risk_level := 'none';
  v_prev_geog    geography;
  v_prev_at      timestamptz;
  v_speed_kmh    double precision;
  v_elapsed_h    double precision;
  v_dev_m        double precision;
  v_incident_id  uuid;
begin
  select current_zone_ids into v_prev_zones from tourists where id = NEW.tourist_id;

  -- (a) resolve current zones
  for v_curr in select * from app.zones_at(NEW.geog, NEW.recorded_at) loop
    v_curr_ids := array_append(v_curr_ids, v_curr.zone_id);
    if v_curr.risk > v_max_risk then v_max_risk := v_curr.risk; end if;

    -- (b) transition INTO a dangerous zone
    if not (v_curr.zone_id = any(coalesce(v_prev_zones, '{}'))) then
      if v_curr.category in ('restricted', 'high_risk', 'border') then
        v_incident_id := app.raise_incident(
          NEW.tourist_id, 'geofence_entry_restricted', NEW.geog, v_curr.zone_id, v_curr.risk,
          jsonb_build_object('zone_name', v_curr.name, 'category', v_curr.category,
                             'ping_id', NEW.id),
          NEW.recorded_at);
      elsif v_curr.risk in ('high','critical') then
        v_incident_id := app.raise_incident(
          NEW.tourist_id, 'zone_time_violation', NEW.geog, v_curr.zone_id, v_curr.risk,
          jsonb_build_object('zone_name', v_curr.name, 'reason', 'time_window'),
          NEW.recorded_at);
      end if;
    end if;
  end loop;

  -- (c) kinematics vs previous ping
  select p.geog, p.recorded_at into v_prev_geog, v_prev_at
    from location_pings p
   where p.tourist_id = NEW.tourist_id and p.id <> NEW.id
   order by p.recorded_at desc limit 1;

  if v_prev_at is not null then
    v_elapsed_h := greatest(extract(epoch from (NEW.recorded_at - v_prev_at)) / 3600.0, 1e-6);
    v_speed_kmh := (ST_Distance(v_prev_geog, NEW.geog) / 1000.0) / v_elapsed_h;
    if v_speed_kmh > 150 then
      perform app.raise_incident(NEW.tourist_id, 'implausible_speed', NEW.geog, null, v_max_risk,
        jsonb_build_object('speed_kmh', round(v_speed_kmh::numeric, 1), 'mock', NEW.is_mock),
        NEW.recorded_at);
    end if;
  end if;

  -- (d) itinerary corridor deviation
  select ST_Distance(i.path, NEW.geog) - i.corridor_m into v_dev_m
    from itineraries i
   where i.tourist_id = NEW.tourist_id and i.active
   order by i.starts_at desc limit 1;

  if v_dev_m is not null and v_dev_m > 0 then
    perform app.raise_incident(NEW.tourist_id, 'route_deviation', NEW.geog, null, v_max_risk,
      jsonb_build_object('deviation_m', round(v_dev_m::numeric, 0)), NEW.recorded_at);
  end if;

  -- (e) battery
  if NEW.battery_pct is not null and NEW.battery_pct <= 10 then
    perform app.raise_incident(NEW.tourist_id, 'battery_critical', NEW.geog, null, v_max_risk,
      jsonb_build_object('battery_pct', NEW.battery_pct), NEW.recorded_at);
  end if;

  -- (f) update cached tourist state
  update tourists
     set last_geog        = NEW.geog,
         last_ping_at     = NEW.recorded_at,
         current_zone_ids = v_curr_ids,
         safety_score     = app.compute_safety_score(NEW.tourist_id),
         updated_at       = now()
   where id = NEW.tourist_id;

  return NEW;
end;
$$;

-- Notify the application layer asynchronously (enrichment, AI, dispatch, anchoring).
-- MUST NOT fail the incident insert: chain / LLM / ML are beside the safety path.
create or replace function app.notify_incident_pipeline()
returns trigger
language plpgsql
security definer
set search_path to public, extensions, app, net, pg_temp
as $$
declare
  v_url  text := current_setting('app.pipeline_url', true);
  v_key  text := current_setting('app.pipeline_secret', true);
begin
  if v_url is null or v_url = '' then
    return NEW;
  end if;

  begin
    perform net.http_post(
      url     := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json',
                                    'x-pipeline-secret', coalesce(v_key, '')),
      body    := jsonb_build_object('incident_id', NEW.id, 'type', NEW.type,
                                    'severity', NEW.severity)
    );
  exception when others then
    raise warning 'pipeline notify failed (incident still recorded): %', sqlerrm;
  end;

  return NEW;
end;
$$;

-- RLS helpers
create or replace function app.my_role() returns user_role
language sql
stable
security definer
set search_path to public, extensions, app, pg_temp
as $$
  select coalesce((select role from profiles where id = auth.uid()), 'tourist'::user_role);
$$;

create or replace function app.my_tourist_id() returns uuid
language sql
stable
security definer
set search_path to public, extensions, app, pg_temp
as $$
  select id from tourists where profile_id = auth.uid();
$$;

create or replace function app.is_staff() returns boolean
language sql
stable
security definer
set search_path to public, extensions, app, pg_temp
as $$
  select app.my_role() in ('admin', 'responder', 'auditor');
$$;

grant execute on all functions in schema app to postgres, anon, authenticated, service_role;
