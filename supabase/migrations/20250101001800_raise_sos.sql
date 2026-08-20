-- Tourists cannot UPDATE incidents (staff-only RLS). A second SOS therefore
-- hit incidents_open_dedupe and looked "sent" on the phone while Command
-- kept showing the stale acknowledged row with no new chime or map pin.
-- This RPC reopens the open SOS (or inserts one) as the signed-in tourist.

create or replace function public.raise_sos(
  p_lon double precision default null,
  p_lat double precision default null,
  p_accuracy_m double precision default null,
  p_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path to public, extensions, app, pg_temp
as $$
declare
  v_tourist_id uuid;
  v_incident_id uuid;
  v_geog geography(Point, 4326);
  v_payload jsonb;
  v_retriggered boolean := false;
  v_msg text;
begin
  v_tourist_id := app.my_tourist_id();
  if v_tourist_id is null then
    raise exception 'tourist profile missing';
  end if;

  v_msg := nullif(btrim(coalesce(p_message, '')), '');
  if v_msg is not null then
    v_msg := left(v_msg, 280);
  end if;

  if p_lon is not null and p_lat is not null
     and p_lon between -180 and 180
     and p_lat between -90 and 90 then
    v_geog := ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography;
  else
    select lp.geog into v_geog
      from location_pings lp
     where lp.tourist_id = v_tourist_id
     order by lp.recorded_at desc
     limit 1;
  end if;

  v_payload := jsonb_strip_nulls(jsonb_build_object(
    'source', 'panic_button',
    'accuracy_m', p_accuracy_m
  ));
  if v_msg is not null then
    v_payload := v_payload || jsonb_build_object('tourist_message', v_msg);
  end if;

  select i.id into v_incident_id
    from incidents i
   where i.tourist_id = v_tourist_id
     and i.type = 'sos'
     and i.status in ('open', 'acknowledged', 'dispatched')
   order by i.occurred_at desc
   limit 1
   for update;

  if v_incident_id is not null then
    v_retriggered := true;
    v_payload := v_payload || jsonb_build_object(
      'retrigger', true,
      'retriggered_at', now()
    );
    update incidents
       set status = 'open',
           severity = 'critical',
           detected_by = 'device',
           geog = coalesce(v_geog, geog),
           payload = coalesce(payload, '{}'::jsonb) || v_payload,
           occurred_at = now(),
           acknowledged_at = null,
           updated_at = now()
     where id = v_incident_id;

    insert into incident_events (incident_id, event_type, actor_id, actor_label, detail)
    values (
      v_incident_id,
      'retriggered',
      auth.uid(),
      'tourist',
      jsonb_build_object('source', 'panic_button')
    );
  else
    insert into incidents (
      tourist_id, type, severity, detected_by, status, geog, payload, occurred_at
    ) values (
      v_tourist_id, 'sos', 'critical', 'device', 'open', v_geog, v_payload, now()
    )
    returning id into v_incident_id;
  end if;

  return jsonb_build_object(
    'id', v_incident_id,
    'retriggered', v_retriggered
  );
end;
$$;

revoke all on function public.raise_sos(double precision, double precision, double precision, text) from public;
grant execute on function public.raise_sos(double precision, double precision, double precision, text)
  to authenticated, service_role;

comment on function public.raise_sos(double precision, double precision, double precision, text) is
  'Hold-to-confirm SOS: insert a critical incident or reopen the tourist''s existing open SOS.';
