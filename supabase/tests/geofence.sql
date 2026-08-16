-- supabase/tests/geofence.sql
-- pgTAP: geofence engine — restricted-zone incident, 5-min dedupe, implausible speed.
-- Runs in a transaction that rolls back. Uses seeded Kaziranga Core Range.

begin;
create extension if not exists pgtap with schema extensions;

select plan(3);

set search_path to public, extensions, app;

-- Isolated tourists (no itinerary) so the only incidents are the ones under test.
insert into tourists (
  id, full_name, nationality, kyc_type, kyc_number_enc, kyc_last4,
  trip_start, trip_end, tracking_enabled, status
) values
(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'Geofence Fixture',
  'IN',
  'passport',
  pgp_sym_encrypt('FIX0001', 'dev-only-pii-key'),
  '0001',
  now() - interval '1 day',
  now() + interval '7 days',
  true,
  'active'
),
(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  'Speed Fixture',
  'IN',
  'passport',
  pgp_sym_encrypt('FIX0002', 'dev-only-pii-key'),
  '0002',
  now() - interval '1 day',
  now() + interval '7 days',
  true,
  'active'
);

-- Interior of Kaziranga Core Range (restricted). Also inside the caution buffer,
-- which must NOT emit a second incident type.
insert into location_pings (tourist_id, geog, accuracy_m, source, recorded_at)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  ST_SetSRID(ST_MakePoint(93.40, 26.62), 4326)::geography,
  8,
  'simulator',
  timestamptz '2025-06-15 10:00:00+05:30'
);

select is(
  (select count(*) from incidents
    where tourist_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
      and type = 'geofence_entry_restricted'),
  1::bigint,
  'inserting a ping inside a restricted zone creates exactly one incident'
);

-- Same tourist, same cell, 30 seconds later — cooldown + unique open-dedupe.
insert into location_pings (tourist_id, geog, accuracy_m, source, recorded_at)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  ST_SetSRID(ST_MakePoint(93.40, 26.62), 4326)::geography,
  8,
  'simulator',
  timestamptz '2025-06-15 10:00:30+05:30'
);

select is(
  (select count(*) from incidents
    where tourist_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'),
  1::bigint,
  'a second ping 30 s later creates zero additional incidents (dedupe works)'
);

-- Rural Assam, well outside seeded polygons. 0.02° latitude ≈ 2.2 km in 36 s ≈ 220 km/h.
insert into location_pings (tourist_id, geog, accuracy_m, source, recorded_at)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  ST_SetSRID(ST_MakePoint(92.00, 26.40), 4326)::geography,
  8,
  'simulator',
  timestamptz '2025-06-15 11:00:00+05:30'
);

insert into location_pings (tourist_id, geog, accuracy_m, source, recorded_at)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  ST_SetSRID(ST_MakePoint(92.00, 26.42), 4326)::geography,
  8,
  'simulator',
  timestamptz '2025-06-15 11:00:36+05:30'
);

select ok(
  exists(
    select 1 from incidents
     where tourist_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
       and type = 'implausible_speed'
  ),
  'a ping at 200 km/h raises implausible_speed'
);

select * from finish();
rollback;
