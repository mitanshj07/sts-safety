-- Public guest IDs, skip-to-app itineraries, and Indian/international KYC policy.
-- Indian travellers: Aadhaar (Voter ID / driving licence equivalent).
-- International travellers: passport.
-- Skip-to-app still issues a scannable digital ID + default NE itinerary.

do $$ begin
  create type kyc_status as enum ('skipped', 'pending', 'verified');
exception when duplicate_object then null;
end $$;

alter table public.tourists
  add column if not exists kyc_status kyc_status not null default 'pending';

comment on column public.tourists.kyc_status is
  'skipped = guest / skip-to-app (still scannable). verified = completed KYC. pending = issued without a final KYC decision.';

-- Map leftover Indian passport rows before the nationality check is applied.
update public.tourists
   set kyc_type = 'aadhaar'
 where upper(nationality) = 'IN'
   and kyc_type = 'passport';

update public.tourists
   set kyc_type = 'passport'
 where upper(nationality) <> 'IN'
   and kyc_type <> 'passport';

alter table public.tourists
  drop constraint if exists tourists_kyc_matches_nationality;

alter table public.tourists
  add constraint tourists_kyc_matches_nationality
  check (
    (upper(nationality) = 'IN' and kyc_type in ('aadhaar', 'voter_id', 'driving_licence'))
    or
    (upper(nationality) <> 'IN' and kyc_type = 'passport')
  );

comment on constraint tourists_kyc_matches_nationality on public.tourists is
  'Indian travellers: Aadhaar, or Voter ID / driving licence. International: passport.';

-- Replace itinerary on re-issue / skip / route change. Keep check-in history
-- only on the row that is currently active.
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
  update public.itineraries
     set active = false
   where tourist_id = p_tourist_id
     and active;

  insert into public.itineraries (
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

revoke all on function public.insert_itinerary_from_geojson(uuid, text, jsonb, integer, jsonb, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.insert_itinerary_from_geojson(uuid, text, jsonb, integer, jsonb, timestamptz, timestamptz)
  to service_role;

-- Anonymous / skip-to-app: tourist row + default Guwahati→Shillong itinerary.
-- Digital ID is still minted by /api/identity/issue so commitments stay keccak256.
create or replace function public.ensure_demo_tourist(p_profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path to public, extensions, pg_temp
as $$
declare
  v_id uuid;
  v_name text;
  v_itin uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and p_profile_id is distinct from auth.uid() then
    raise exception 'not allowed';
  end if;

  insert into public.profiles (id, role, display_name, locale)
  values (p_profile_id, 'tourist', 'Guest traveller', 'en')
  on conflict (id) do nothing;

  select id into v_id from public.tourists where profile_id = p_profile_id;
  if v_id is null then
    select display_name into v_name from public.profiles where id = p_profile_id;

    insert into public.tourists (
      profile_id, full_name, nationality,
      kyc_type, kyc_number_enc, kyc_last4, kyc_status,
      email, trip_start, trip_end, entry_point, status
    ) values (
      p_profile_id,
      coalesce(nullif(v_name, ''), 'Guest traveller'),
      'IN',
      'aadhaar',
      pgp_sym_encrypt('234123412346', 'dev-only-pii-key'),
      '2346',
      'skipped',
      null,
      now(),
      now() + interval '7 days',
      'Guwahati LGBI Airport',
      'active'
    )
    returning id into v_id;
  end if;

  select i.id into v_itin
    from public.itineraries i
   where i.tourist_id = v_id
     and i.active
   order by i.starts_at desc
   limit 1;

  if v_itin is null then
    perform public.insert_itinerary_from_geojson(
      v_id,
      'Guwahati → Shillong (NH-6)',
      '{"type":"LineString","coordinates":[[91.7362,26.1445],[91.778,26.121],[91.821,26.119],[91.8631,26.1],[91.878,26.051],[91.88,25.908],[91.889,25.748],[91.896,25.653],[91.893,25.5788]]}'::jsonb,
      2000,
      '[{"name":"Guwahati","lat":26.1445,"lon":91.7362,"dwell_minutes":30,"checkin_required":true},{"name":"Jorabat checkpoint","lat":26.1,"lon":91.8631,"dwell_minutes":10,"checkin_required":true},{"name":"Umiam Lake","lat":25.653,"lon":91.896,"dwell_minutes":20,"checkin_required":false},{"name":"Shillong","lat":25.5788,"lon":91.893,"dwell_minutes":120,"checkin_required":true}]'::jsonb,
      now(),
      now() + interval '7 days'
    );
  end if;

  return v_id;
end;
$$;

grant execute on function public.ensure_demo_tourist(uuid) to authenticated, service_role;
