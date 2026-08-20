-- Clustered SOS from four distinct demo tourists at Dawki / Umngot (Meghalaya).
-- The area is popular with visitors and is not a seeded reserved polygon, so the
-- AI suggestion dashboard can recommend marking it restricted.

insert into incidents (
  id, tourist_id, type, severity, status, detected_by,
  geog, address_text, payload, occurred_at
) values
(
  '44444444-4444-4444-8444-444444444401',
  '22222222-2222-4222-8222-222222222201',
  'sos', 'critical', 'open', 'device',
  ST_SetSRID(ST_MakePoint(92.0167, 25.1833), 4326)::geography,
  'Dawki Umngot viewpoint, Meghalaya',
  '{"source":"seed","hotspot":"dawki"}'::jsonb,
  now() - interval '42 minutes'
),
(
  '44444444-4444-4444-8444-444444444402',
  '22222222-2222-4222-8222-222222222202',
  'sos', 'critical', 'open', 'device',
  ST_SetSRID(ST_MakePoint(92.0179, 25.1841), 4326)::geography,
  'Dawki Umngot viewpoint, Meghalaya',
  '{"source":"seed","hotspot":"dawki"}'::jsonb,
  now() - interval '35 minutes'
),
(
  '44444444-4444-4444-8444-444444444403',
  '22222222-2222-4222-8222-222222222203',
  'sos', 'critical', 'open', 'device',
  ST_SetSRID(ST_MakePoint(92.0154, 25.1826), 4326)::geography,
  'Dawki Umngot viewpoint, Meghalaya',
  '{"source":"seed","hotspot":"dawki"}'::jsonb,
  now() - interval '28 minutes'
),
(
  '44444444-4444-4444-8444-444444444404',
  '22222222-2222-4222-8222-222222222204',
  'sos', 'critical', 'open', 'device',
  ST_SetSRID(ST_MakePoint(92.0182, 25.1838), 4326)::geography,
  'Dawki Umngot viewpoint, Meghalaya',
  '{"source":"seed","hotspot":"dawki"}'::jsonb,
  now() - interval '19 minutes'
),
(
  '44444444-4444-4444-8444-444444444405',
  '22222222-2222-4222-8222-222222222205',
  'signal_lost', 'high', 'open', 'rules',
  ST_SetSRID(ST_MakePoint(92.0160, 25.1845), 4326)::geography,
  'Dawki Umngot viewpoint, Meghalaya',
  '{"source":"seed","hotspot":"dawki","silence_minutes":22}'::jsonb,
  now() - interval '14 minutes'
)
on conflict (id) do nothing;

insert into incident_events (incident_id, event_type, actor_label, detail)
select i.id, 'created', 'seed', jsonb_build_object('hotspot', 'dawki')
  from incidents i
 where i.id in (
   '44444444-4444-4444-8444-444444444401',
   '44444444-4444-4444-8444-444444444402',
   '44444444-4444-4444-8444-444444444403',
   '44444444-4444-4444-8444-444444444404',
   '44444444-4444-4444-8444-444444444405'
 )
   and not exists (
     select 1 from incident_events e
      where e.incident_id = i.id and e.event_type = 'created'
   );
