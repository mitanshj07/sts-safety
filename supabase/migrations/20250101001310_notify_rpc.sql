-- supabase/migrations/20250101001310_notify_rpc.sql
-- Public wrapper around app.nearest_responders so the dispatcher can call it
-- via PostgREST (service role). Lon/lat in, not raw geography.

create or replace function public.nearest_responders(
  p_lon double precision,
  p_lat double precision,
  p_limit integer default 3
)
returns table (
  responder_id uuid,
  name text,
  distance_m double precision,
  telegram_chat_id text
)
language sql
stable
security definer
set search_path to public, extensions, app, pg_temp
as $$
  select r.responder_id, r.name, r.distance_m, r.telegram_chat_id
    from app.nearest_responders(
      ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography,
      p_limit
    ) r;
$$;

grant execute on function public.nearest_responders(double precision, double precision, integer)
  to anon, authenticated, service_role;

comment on function public.nearest_responders(double precision, double precision, integer) is
  'PostgREST wrapper for app.nearest_responders. Used by notification fan-out.';
