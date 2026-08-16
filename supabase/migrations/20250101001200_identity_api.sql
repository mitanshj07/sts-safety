-- supabase/migrations/20250101001200_identity_api.sql
-- Helpers for Digital ID issuance: atomic HD index, pgcrypto KYC encrypt,
-- GeoJSON itinerary insert. Service-role only. No PII in return values
-- except the ciphertext bytea of encrypt_pii.

create or replace function public.allocate_hd_index()
returns integer
language plpgsql
security definer
set search_path to public, pg_temp
as $$
declare
  n integer;
begin
  perform pg_advisory_xact_lock(87231001);
  select coalesce(max(hd_index), -1) + 1 into n from tourists;
  return n;
end;
$$;

create or replace function public.encrypt_pii(p_plaintext text, p_key text)
returns bytea
language sql
security definer
set search_path to public, extensions, pg_temp
as $$
  select pgp_sym_encrypt(p_plaintext, p_key);
$$;

create or replace function public.insert_itinerary_from_geojson(
  p_tourist_id uuid,
  p_title text,
  p_geojson jsonb,
  p_corridor_m integer,
  p_waypoints jsonb,
  p_starts_at timestamptz,
  p_ends_at timestamptz
) returns uuid
language plpgsql
security definer
set search_path to public, extensions, pg_temp
as $$
declare
  new_id uuid;
begin
  insert into itineraries (
    tourist_id, title, path, corridor_m, waypoints, starts_at, ends_at, active
  ) values (
    p_tourist_id,
    p_title,
    ST_SetSRID(ST_GeomFromGeoJSON(p_geojson::text), 4326)::geography,
    p_corridor_m,
    coalesce(p_waypoints, '[]'::jsonb),
    p_starts_at,
    p_ends_at,
    true
  )
  returning id into new_id;
  return new_id;
end;
$$;

-- One in-flight credential per tourist (pending or active).
create unique index if not exists digital_ids_one_inflight
  on digital_ids (tourist_id)
  where status in ('pending', 'active');

revoke all on function public.allocate_hd_index() from public, anon, authenticated;
revoke all on function public.encrypt_pii(text, text) from public, anon, authenticated;
revoke all on function public.insert_itinerary_from_geojson(uuid, text, jsonb, integer, jsonb, timestamptz, timestamptz)
  from public, anon, authenticated;

grant execute on function public.allocate_hd_index() to service_role;
grant execute on function public.encrypt_pii(text, text) to service_role;
grant execute on function public.insert_itinerary_from_geojson(uuid, text, jsonb, integer, jsonb, timestamptz, timestamptz)
  to service_role;
