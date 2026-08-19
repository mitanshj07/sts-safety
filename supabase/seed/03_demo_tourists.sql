-- supabase/seed/03_demo_tourists.sql
-- Five demo tourists + itineraries along real NE highways.
-- Auth users are best-effort: tourists still seed if GoTrue columns differ.
-- Local password for every demo login: DemoPass123!

create or replace function app.seed_demo_auth_user(
  p_id uuid,
  p_email text,
  p_password text,
  p_display_name text
) returns void
language plpgsql
security definer
set search_path to auth, public, extensions, pg_temp
as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    p_id,
    'authenticated',
    'authenticated',
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('display_name', p_display_name),
    now(), now(),
    '', '', '', ''
  )
  on conflict (id) do nothing;

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    p_id,
    p_id,
    p_id::text,
    jsonb_build_object('sub', p_id::text, 'email', p_email),
    'email',
    now(), now(), now()
  )
  on conflict do nothing;
exception
  when others then
    raise notice 'auth seed skipped for %: %', p_email, sqlerrm;
end;
$$;

select app.seed_demo_auth_user(
  '33333333-3333-4333-8333-333333333301',
  'priya.sharma@demo.sts', 'DemoPass123!', 'Priya Sharma');
select app.seed_demo_auth_user(
  '33333333-3333-4333-8333-333333333302',
  'ananya.baruah@demo.sts', 'DemoPass123!', 'Ananya Baruah');
select app.seed_demo_auth_user(
  '33333333-3333-4333-8333-333333333303',
  'emma.wilson@demo.sts', 'DemoPass123!', 'Emma Wilson');
select app.seed_demo_auth_user(
  '33333333-3333-4333-8333-333333333304',
  'tenzin.dorje@demo.sts', 'DemoPass123!', 'Tenzin Dorje');
select app.seed_demo_auth_user(
  '33333333-3333-4333-8333-333333333305',
  'kenji.nakamura@demo.sts', 'DemoPass123!', 'Kenji Nakamura');

insert into profiles (id, role, display_name, locale)
select u.id, 'tourist'::user_role, u.raw_user_meta_data->>'display_name', 'en'
  from auth.users u
 where u.id in (
   '33333333-3333-4333-8333-333333333301',
   '33333333-3333-4333-8333-333333333302',
   '33333333-3333-4333-8333-333333333303',
   '33333333-3333-4333-8333-333333333304',
   '33333333-3333-4333-8333-333333333305'
 )
on conflict (id) do update set
  display_name = excluded.display_name,
  role         = excluded.role;

insert into tourists (
  id, profile_id, full_name, nationality, date_of_birth,
  kyc_type, kyc_number_enc, kyc_last4, kyc_salt, kyc_status,
  phone_e164, email, emergency_contacts,
  trip_start, trip_end, entry_point,
  safety_score, tracking_enabled, hd_index, status
) values
(
  '22222222-2222-4222-8222-222222222201',
  (select id from profiles where id = '33333333-3333-4333-8333-333333333301'),
  'Priya Sharma', 'IN', '1998-04-12',
  'aadhaar', pgp_sym_encrypt('234123412346', 'dev-only-pii-key'), '2346',
  decode('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'hex'),
  'verified',
  '+919864210001', 'priya.sharma@demo.sts',
  '[{"name":"Amit Sharma","relation":"father","phone_e164":"+919864210011","notify":true}]'::jsonb,
  now() - interval '1 day', now() + interval '10 days',
  'Guwahati LGBI Airport', 100, true, 1, 'active'
),
(
  '22222222-2222-4222-8222-222222222202',
  (select id from profiles where id = '33333333-3333-4333-8333-333333333302'),
  'Ananya Baruah', 'IN', '1996-11-03',
  'aadhaar', pgp_sym_encrypt('999988887779', 'dev-only-pii-key'), '7779',
  decode('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'hex'),
  'verified',
  '+919864210002', 'ananya.baruah@demo.sts',
  '[{"name":"Nandini Baruah","relation":"mother","phone_e164":"+919864210012","notify":true}]'::jsonb,
  now() - interval '1 day', now() + interval '12 days',
  'Guwahati LGBI Airport', 100, true, 2, 'active'
),
(
  '22222222-2222-4222-8222-222222222203',
  (select id from profiles where id = '33333333-3333-4333-8333-333333333303'),
  'Emma Wilson', 'GB', '1994-07-21',
  'passport', pgp_sym_encrypt('GB7654321', 'dev-only-pii-key'), '4321',
  decode('cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc', 'hex'),
  'verified',
  '+447700900203', 'emma.wilson@demo.sts',
  '[{"name":"James Wilson","relation":"spouse","phone_e164":"+447700900213","notify":true}]'::jsonb,
  now() - interval '2 days', now() + interval '14 days',
  'Tezpur Airport (Salonibari)', 100, true, 3, 'active'
),
(
  '22222222-2222-4222-8222-222222222204',
  (select id from profiles where id = '33333333-3333-4333-8333-333333333304'),
  'Tenzin Dorje', 'IN', '1991-02-08',
  'voter_id', pgp_sym_encrypt('ARX1234567', 'dev-only-pii-key'), '4567',
  decode('dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd', 'hex'),
  'verified',
  '+919364210004', 'tenzin.dorje@demo.sts',
  '[{"name":"Pema Dorje","relation":"brother","phone_e164":"+919364210014","notify":true}]'::jsonb,
  now() - interval '1 day', now() + interval '8 days',
  'Tezpur (road)', 100, true, 4, 'active'
),
(
  '22222222-2222-4222-8222-222222222205',
  (select id from profiles where id = '33333333-3333-4333-8333-333333333305'),
  'Kenji Nakamura', 'JP', '1989-09-30',
  'passport', pgp_sym_encrypt('TS7654321', 'dev-only-pii-key'), '4321',
  decode('eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', 'hex'),
  'verified',
  '+819012345205', 'kenji.nakamura@demo.sts',
  '[{"name":"Yuki Nakamura","relation":"sister","phone_e164":"+819012345215","notify":true}]'::jsonb,
  now() - interval '1 day', now() + interval '7 days',
  'Guwahati LGBI Airport', 100, true, 5, 'active'
)
on conflict (id) do update set
  full_name    = excluded.full_name,
  trip_start   = excluded.trip_start,
  trip_end     = excluded.trip_end,
  profile_id   = excluded.profile_id,
  email        = excluded.email,
  kyc_type     = excluded.kyc_type,
  kyc_status   = excluded.kyc_status,
  status       = excluded.status,
  updated_at   = now();

-- Itineraries: GeoJSON LineStrings along real roads (lon,lat).
insert into itineraries (
  id, tourist_id, title, path, corridor_m, waypoints, starts_at, ends_at, active
) values
-- Priya: Guwahati → Shillong on NH-6 / GS Road
(
  '44444444-4444-4444-8444-444444444401',
  '22222222-2222-4222-8222-222222222201',
  'Guwahati → Shillong (NH-6)',
  ST_SetSRID(ST_GeomFromGeoJSON($geo$
    {"type":"LineString","coordinates":[
      [91.7362,26.1445],[91.7780,26.1210],[91.8210,26.1190],[91.8631,26.1000],
      [91.8780,26.0510],[91.8800,25.9080],[91.8890,25.7480],[91.8960,25.6530],
      [91.8930,25.5788]
    ]}
  $geo$), 4326)::geography,
  2000,
  $wp$[{"name":"Guwahati","lat":26.1445,"lon":91.7362,"dwell_minutes":30,"checkin_required":true},{"name":"Jorabat checkpoint","lat":26.1000,"lon":91.8631,"dwell_minutes":10,"checkin_required":true},{"name":"Umiam Lake","lat":25.6530,"lon":91.8960,"dwell_minutes":20,"checkin_required":false},{"name":"Shillong","lat":25.5788,"lon":91.8930,"dwell_minutes":120,"checkin_required":true}]$wp$::jsonb,
  now() - interval '1 day', now() + interval '3 days', true
),
-- Ananya: Guwahati → Shillong → Cherrapunji (Sohra)
(
  '44444444-4444-4444-8444-444444444402',
  '22222222-2222-4222-8222-222222222202',
  'Guwahati → Shillong → Cherrapunji',
  ST_SetSRID(ST_GeomFromGeoJSON($geo$
    {"type":"LineString","coordinates":[
      [91.7362,26.1445],[91.7780,26.1210],[91.8210,26.1190],[91.8631,26.1000],
      [91.8780,26.0510],[91.8800,25.9080],[91.8890,25.7480],[91.8960,25.6530],
      [91.8930,25.5788],[91.8800,25.4800],[91.8200,25.4200],[91.7500,25.3600],
      [91.6963,25.3009]
    ]}
  $geo$), 4326)::geography,
  2500,
  $wp$[{"name":"Guwahati","lat":26.1445,"lon":91.7362,"dwell_minutes":20,"checkin_required":true},{"name":"Shillong","lat":25.5788,"lon":91.8930,"dwell_minutes":60,"checkin_required":true},{"name":"Sohra (Cherrapunji)","lat":25.3009,"lon":91.6963,"dwell_minutes":180,"checkin_required":true}]$wp$::jsonb,
  now() - interval '1 day', now() + interval '5 days', true
),
-- Emma: Tezpur → Tawang via Bomdila / Sela Pass (NH-13)
(
  '44444444-4444-4444-8444-444444444403',
  '22222222-2222-4222-8222-222222222203',
  'Tezpur → Tawang (NH-13)',
  ST_SetSRID(ST_GeomFromGeoJSON($geo$
    {"type":"LineString","coordinates":[
      [92.8000,26.6330],[92.7730,26.8300],[92.6450,27.0110],[92.6100,27.0380],
      [92.4630,27.2170],[92.4080,27.2650],[92.2670,27.3500],[92.1050,27.5040],
      [91.9800,27.5750],[91.8650,27.5860]
    ]}
  $geo$), 4326)::geography,
  3000,
  $wp$[{"name":"Tezpur","lat":26.6330,"lon":92.8000,"dwell_minutes":30,"checkin_required":true},{"name":"Bhalukpong","lat":27.0110,"lon":92.6450,"dwell_minutes":20,"checkin_required":true},{"name":"Bomdila","lat":27.2650,"lon":92.4080,"dwell_minutes":60,"checkin_required":true},{"name":"Sela Pass","lat":27.5040,"lon":92.1050,"dwell_minutes":15,"checkin_required":true},{"name":"Tawang","lat":27.5860,"lon":91.8650,"dwell_minutes":240,"checkin_required":true}]$wp$::jsonb,
  now() - interval '2 days', now() + interval '10 days', true
),
-- Tenzin: same Tezpur → Tawang corridor (pilgrim / local)
(
  '44444444-4444-4444-8444-444444444404',
  '22222222-2222-4222-8222-222222222204',
  'Tezpur → Tawang (pilgrim)',
  ST_SetSRID(ST_GeomFromGeoJSON($geo$
    {"type":"LineString","coordinates":[
      [92.8000,26.6330],[92.7730,26.8300],[92.6450,27.0110],[92.4630,27.2170],
      [92.4080,27.2650],[92.2670,27.3500],[92.1050,27.5040],[91.9800,27.5750],
      [91.8650,27.5860]
    ]}
  $geo$), 4326)::geography,
  3000,
  $wp$[{"name":"Tezpur","lat":26.6330,"lon":92.8000,"dwell_minutes":15,"checkin_required":false},{"name":"Dirang","lat":27.3500,"lon":92.2670,"dwell_minutes":45,"checkin_required":true},{"name":"Tawang Monastery","lat":27.5860,"lon":91.8590,"dwell_minutes":180,"checkin_required":true}]$wp$::jsonb,
  now() - interval '1 day', now() + interval '8 days', true
),
-- Kenji: Guwahati → Kaziranga (NH-27 / NH-37)
(
  '44444444-4444-4444-8444-444444444405',
  '22222222-2222-4222-8222-222222222205',
  'Guwahati → Kaziranga (NH-37)',
  ST_SetSRID(ST_GeomFromGeoJSON($geo$
    {"type":"LineString","coordinates":[
      [91.7362,26.1445],[92.0500,26.1300],[92.2000,26.1200],[92.4500,26.2200],
      [92.6800,26.3500],[93.0400,26.5200],[93.2690,26.5770],[93.4112,26.5765]
    ]}
  $geo$), 4326)::geography,
  2500,
  $wp$[{"name":"Guwahati","lat":26.1445,"lon":91.7362,"dwell_minutes":20,"checkin_required":true},{"name":"Nagaon","lat":26.3500,"lon":92.6800,"dwell_minutes":20,"checkin_required":false},{"name":"Kohora (Kaziranga)","lat":26.5765,"lon":93.4112,"dwell_minutes":240,"checkin_required":true}]$wp$::jsonb,
  now() - interval '1 day', now() + interval '6 days', true
)
on conflict (id) do update set
  title      = excluded.title,
  path       = excluded.path,
  corridor_m = excluded.corridor_m,
  waypoints  = excluded.waypoints,
  starts_at  = excluded.starts_at,
  ends_at    = excluded.ends_at,
  active     = excluded.active;

-- Scannable digital IDs for every seeded tourist (chain token optional).
insert into digital_ids (
  id, tourist_id, chain_id, contract_address, holder_address,
  kyc_commitment, itinerary_hash, valid_from, valid_until, status
) values
(
  '55555555-5555-4555-8555-555555555501',
  '22222222-2222-4222-8222-222222222201',
  80002, '0x0000000000000000000000000000000000000000',
  '0x0000000000000000000000000000000000000001',
  '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  '0x1111111111111111111111111111111111111111111111111111111111111111',
  now() - interval '1 day', now() + interval '10 days', 'active'
),
(
  '55555555-5555-4555-8555-555555555502',
  '22222222-2222-4222-8222-222222222202',
  80002, '0x0000000000000000000000000000000000000000',
  '0x0000000000000000000000000000000000000002',
  '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  '0x2222222222222222222222222222222222222222222222222222222222222222',
  now() - interval '1 day', now() + interval '12 days', 'active'
),
(
  '55555555-5555-4555-8555-555555555503',
  '22222222-2222-4222-8222-222222222203',
  80002, '0x0000000000000000000000000000000000000000',
  '0x0000000000000000000000000000000000000003',
  '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
  '0x3333333333333333333333333333333333333333333333333333333333333333',
  now() - interval '2 days', now() + interval '14 days', 'active'
),
(
  '55555555-5555-4555-8555-555555555504',
  '22222222-2222-4222-8222-222222222204',
  80002, '0x0000000000000000000000000000000000000000',
  '0x0000000000000000000000000000000000000004',
  '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
  '0x4444444444444444444444444444444444444444444444444444444444444444',
  now() - interval '1 day', now() + interval '8 days', 'active'
),
(
  '55555555-5555-4555-8555-555555555505',
  '22222222-2222-4222-8222-222222222205',
  80002, '0x0000000000000000000000000000000000000000',
  '0x0000000000000000000000000000000000000005',
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  '0x5555555555555555555555555555555555555555555555555555555555555555',
  now() - interval '1 day', now() + interval '7 days', 'active'
)
on conflict (id) do update set
  status     = excluded.status,
  valid_from = excluded.valid_from,
  valid_until = excluded.valid_until,
  updated_at = now();
