-- supabase/seed/02_responders.sql
-- On-duty units with real station coordinates across five NE states.

insert into responders (
  id, name, unit_type, station_name, phone_e164,
  base_geog, coverage_m, on_duty, state_code, district
) values
-- 1. Assam — Guwahati tourist police, Panbazar
(
  '21111111-1111-4111-8111-111111111101',
  'SI Baruah — Guwahati Tourist Police',
  'tourist_police',
  'Tourist Police Beat, Panbazar, Guwahati',
  '+913612511000',
  ST_SetSRID(ST_MakePoint(91.7454, 26.1873), 4326)::geography,
  20000, true, 'AS', 'Kamrup Metropolitan'
),
-- 2. Assam — Kohora / Kaziranga forest-police outpost
(
  '21111111-1111-4111-8111-111111111102',
  'Range Officer Das — Kaziranga Kohora',
  'forest',
  'Kohora Police Outpost / Forest Range, Kaziranga',
  '+913776262001',
  ST_SetSRID(ST_MakePoint(93.4112, 26.5765), 4326)::geography,
  25000, true, 'AS', 'Golaghat'
),
-- 3. Assam — Tezpur Sadar PS (start of the Tawang road)
(
  '21111111-1111-4111-8111-111111111103',
  'Inspector Sharma — Tezpur Sadar',
  'police_station',
  'Tezpur Sadar Police Station',
  '+913712220210',
  ST_SetSRID(ST_MakePoint(92.7926, 26.6528), 4326)::geography,
  20000, true, 'AS', 'Sonitpur'
),
-- 4. Meghalaya — Shillong Sadar
(
  '21111111-1111-4111-8111-111111111104',
  'SI Nongkynrih — Shillong Sadar',
  'police_station',
  'Sadar Police Station, Kachari, Shillong',
  '+913642224000',
  ST_SetSRID(ST_MakePoint(91.8828, 25.5788), 4326)::geography,
  18000, true, 'ML', 'East Khasi Hills'
),
-- 5. Meghalaya — Sohra (Cherrapunji) PS
(
  '21111111-1111-4111-8111-111111111105',
  'ASI Khongwir — Sohra PS',
  'police_station',
  'Sohra Police Station, Cherrapunji',
  '+913637235014',
  ST_SetSRID(ST_MakePoint(91.7322, 25.2702), 4326)::geography,
  20000, true, 'ML', 'East Khasi Hills'
),
-- 6. Arunachal Pradesh — Tawang PS
(
  '21111111-1111-4111-8111-111111111106',
  'SI Tsering — Tawang PS',
  'police_station',
  'Tawang Police Station',
  '+913782222221',
  ST_SetSRID(ST_MakePoint(91.8653, 27.5876), 4326)::geography,
  30000, true, 'AR', 'Tawang'
),
-- 7. Nagaland — Kohima North PS (Dzukou access)
(
  '21111111-1111-4111-8111-111111111107',
  'SI Angami — Kohima North',
  'police_station',
  'North Police Station, Kohima',
  '+913702290333',
  ST_SetSRID(ST_MakePoint(94.1103, 25.6747), 4326)::geography,
  25000, true, 'NL', 'Kohima'
),
-- 8. Manipur — Imphal tourist police (Loktak access)
(
  '21111111-1111-4111-8111-111111111108',
  'SI Singh — Imphal Tourist Police',
  'tourist_police',
  'Tourist Police, Imphal West',
  '+913852450128',
  ST_SetSRID(ST_MakePoint(93.9368, 24.8170), 4326)::geography,
  25000, true, 'MN', 'Imphal West'
)
on conflict (id) do update set
  name         = excluded.name,
  unit_type    = excluded.unit_type,
  station_name = excluded.station_name,
  phone_e164   = excluded.phone_e164,
  base_geog    = excluded.base_geog,
  coverage_m   = excluded.coverage_m,
  on_duty      = excluded.on_duty,
  state_code   = excluded.state_code,
  district     = excluded.district;
