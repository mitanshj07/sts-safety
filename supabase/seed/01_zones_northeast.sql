-- supabase/seed/01_zones_northeast.sql
-- Realistic geofence polygons across India's North East.
-- GeoJSON is lon,lat; ST_GeomFromGeoJSON returns SRID 0 — always ST_SetSRID(..., 4326)::geography.
-- Rings are closed and wound counter-clockwise (RFC 7946).

insert into zones (
  id, name, name_local, description, category, risk_level,
  geom, time_windows, requires_permit, advisory_text,
  state_code, district, active
) values
-- 1. Kaziranga core (restricted) — Central/Kohora range, rhino habitat
(
  '11111111-1111-4111-8111-111111111101',
  'Kaziranga Core Range',
  '{"as":"কাজিৰঙা মূল অঞ্চল","hi":"काजीरंगा कोर रेंज"}'::jsonb,
  'UNESCO World Heritage core. Indian one-horned rhino habitat. Entry without forest escort is prohibited.',
  'restricted',
  'critical',
  ST_SetSRID(ST_GeomFromGeoJSON($geo$
    {"type":"Polygon","coordinates":[[[93.30,26.57],[93.38,26.54],[93.47,26.56],[93.49,26.64],[93.42,26.70],[93.32,26.68],[93.30,26.57]]]}
  $geo$), 4326)::geography,
  '[]'::jsonb,
  true,
  'Restricted forest. Leave immediately and contact Kaziranga Forest Range, Kohora.',
  'AS', 'Golaghat', true
),
-- 2. Kaziranga buffer (caution) — NH-37 fringe, Bagori to Agoratoli
(
  '11111111-1111-4111-8111-111111111102',
  'Kaziranga Buffer',
  '{"as":"কাজিৰঙা বাফাৰ","hi":"काजीरंगा बफर"}'::jsonb,
  'Park buffer along NH-37. Animal crossings at dusk. Stay on the highway corridor.',
  'caution',
  'medium',
  ST_SetSRID(ST_GeomFromGeoJSON($geo$
    {"type":"Polygon","coordinates":[[[93.18,26.50],[93.58,26.50],[93.62,26.78],[93.20,26.78],[93.18,26.50]]]}
  $geo$), 4326)::geography,
  '[]'::jsonb,
  false,
  'Caution: wildlife crossing. Do not stop after 16:30. No night driving on park-edge roads.',
  'AS', 'Golaghat', true
),
-- 3. Tawang town (safe)
(
  '11111111-1111-4111-8111-111111111103',
  'Tawang Town',
  '{"hi":"तवांग नगर"}'::jsonb,
  'Tawang monastery town, district HQ. Safe urban envelope including the bazaar and monastery ridge.',
  'safe',
  'low',
  ST_SetSRID(ST_GeomFromGeoJSON($geo$
    {"type":"Polygon","coordinates":[[[91.850,27.575],[91.880,27.575],[91.880,27.600],[91.850,27.600],[91.850,27.575]]]}
  $geo$), 4326)::geography,
  '[]'::jsonb,
  false,
  'Stay within town after dark. Inner Line Permit required for the district, already assumed at entry.',
  'AR', 'Tawang', true
),
-- 4. Bum La Pass approach (border, high_risk) — India–China (Tibet) LAC
(
  '11111111-1111-4111-8111-111111111104',
  'Bum La Pass Approach',
  '{"hi":"बम ला दर्रा"}'::jsonb,
  'Army-controlled approach to Bum La (Bumla) Pass on the Line of Actual Control. Permit + escort mandatory.',
  'border',
  'high',
  ST_SetSRID(ST_GeomFromGeoJSON($geo$
    {"type":"Polygon","coordinates":[[[91.820,27.720],[91.860,27.720],[91.860,27.760],[91.820,27.760],[91.820,27.720]]]}
  $geo$), 4326)::geography,
  '[]'::jsonb,
  true,
  'International border zone. Do not proceed without ITBP/Army permit. Photography restricted.',
  'AR', 'Tawang', true
),
-- 5. Cherrapunji viewpoints (caution) — Sohra / Nohkalikai
(
  '11111111-1111-4111-8111-111111111105',
  'Cherrapunji Viewpoints',
  '{"as":"চোৰা","hi":"चेरापूंजी"}'::jsonb,
  'Sohra (Cherrapunji) cliff viewpoints including Nohkalikai Falls. Wet rock, sudden fog, unfenced edges.',
  'caution',
  'medium',
  ST_SetSRID(ST_GeomFromGeoJSON($geo$
    {"type":"Polygon","coordinates":[[[91.670,25.250],[91.740,25.250],[91.740,25.320],[91.670,25.320],[91.670,25.250]]]}
  $geo$), 4326)::geography,
  '[]'::jsonb,
  false,
  'Stay behind railings. Trails close in heavy rain. Mobile signal drops in the gorge.',
  'ML', 'East Khasi Hills', true
),
-- 6. Living Root Bridges trail (caution) — Nongriat double-decker
(
  '11111111-1111-4111-8111-111111111106',
  'Living Root Bridges Trail',
  '{"hi":"जीवित जड़ पुल"}'::jsonb,
  'Nongriat double-decker living root bridge trek. 3,000+ steps, flash-flood gullies, no night return.',
  'caution',
  'medium',
  ST_SetSRID(ST_GeomFromGeoJSON($geo$
    {"type":"Polygon","coordinates":[[[91.655,25.230],[91.695,25.230],[91.695,25.265],[91.655,25.265],[91.655,25.230]]]}
  $geo$), 4326)::geography,
  '[]'::jsonb,
  false,
  'Start descent before 11:00. Do not trek after 15:00. Carry water; no shops on the steps.',
  'ML', 'East Khasi Hills', true
),
-- 7. Loktak Lake (safe) — floating phumdis, Keibul Lamjao fringe
(
  '11111111-1111-4111-8111-111111111107',
  'Loktak Lake',
  '{"hi":"लोकतक झील"}'::jsonb,
  'Loktak Lake water body and shoreline, including Sendra and the phumdi villages. Boat travel is routine.',
  'safe',
  'low',
  ST_SetSRID(ST_GeomFromGeoJSON($geo$
    {"type":"Polygon","coordinates":[[[93.760,24.430],[93.920,24.430],[93.920,24.630],[93.760,24.630],[93.760,24.430]]]}
  $geo$), 4326)::geography,
  '[]'::jsonb,
  false,
  'Lifejackets on hired boats. Keibul Lamjao National Park (sangai) is a separate permit zone on the south shore.',
  'MN', 'Bishnupur', true
),
-- 8. Dzukou Valley trek (high_risk) — Nagaland/Manipur border valley
(
  '11111111-1111-4111-8111-111111111108',
  'Dzukou Valley Trek',
  '{"hi":"दजुको घाटी"}'::jsonb,
  'Dzukou Valley alpine trek. Sub-zero nights, white-out fog, 2015/2020–21 wildfire history. No night movement.',
  'high_risk',
  'high',
  ST_SetSRID(ST_GeomFromGeoJSON($geo$
    {"type":"Polygon","coordinates":[[[94.040,25.520],[94.105,25.520],[94.105,25.590],[94.040,25.590],[94.040,25.520]]]}
  $geo$), 4326)::geography,
  '[]'::jsonb,
  true,
  'Register at Viswema/Zakhama checkpost. Carry layers and a charged power bank. Do not descend after 14:00.',
  'NL', 'Kohima', true
),
-- 9. Guwahati city centre (safe) — Panbazar / Fancy Bazaar / Uzan Bazar
(
  '11111111-1111-4111-8111-111111111109',
  'Guwahati City Centre',
  '{"as":"গুৱাহাটী","hi":"गुवाहाटी"}'::jsonb,
  'Central Guwahati urban core: Panbazar, Fancy Bazaar, riverfront, and the MG Road hotel strip.',
  'safe',
  'none',
  ST_SetSRID(ST_GeomFromGeoJSON($geo$
    {"type":"Polygon","coordinates":[[[91.720,26.160],[91.780,26.160],[91.780,26.200],[91.720,26.200],[91.720,26.160]]]}
  $geo$), 4326)::geography,
  '[]'::jsonb,
  false,
  null,
  'AS', 'Kamrup Metropolitan', true
),
-- 10. Night-restricted forest — Manas National Park (safe by day, high at night)
(
  '11111111-1111-4111-8111-111111111110',
  'Manas National Park (night-restricted)',
  '{"as":"মানস ৰাষ্ট্ৰীয় উদ্যান","hi":"मानस राष्ट्रीय उद्यान"}'::jsonb,
  'Manas Tiger Reserve. Day safari permitted; the forest is closed and high-risk from dusk to dawn.',
  'forest_reserve',
  'high',
  ST_SetSRID(ST_GeomFromGeoJSON($geo$
    {"type":"Polygon","coordinates":[[[90.850,26.650],[91.150,26.650],[91.150,26.850],[90.850,26.850],[90.850,26.650]]]}
  $geo$), 4326)::geography,
  $tw$[{"days":[0,1,2,3,4,5,6],"from":"05:30","to":"17:30","risk_level":"low"}]$tw$::jsonb,
  true,
  'Forest roads close at 17:30. Night presence is treated as a time-window violation.',
  'AS', 'Baksa', true
),
-- 11. Hotel zone — Hotel Brahmaputra Ashok / MG Road, Guwahati
(
  '11111111-1111-4111-8111-111111111111',
  'Hotel Brahmaputra Ashok (Guwahati)',
  '{"hi":"होटल ब्रह्मपुत्र अशोक"}'::jsonb,
  'Licensed tourist accommodation on MG Road, Guwahati. Overnight stay is expected.',
  'accommodation',
  'none',
  ST_SetSRID(ST_GeomFromGeoJSON($geo$
    {"type":"Polygon","coordinates":[[[91.7475,26.1795],[91.7508,26.1795],[91.7508,26.1818],[91.7475,26.1818],[91.7475,26.1795]]]}
  $geo$), 4326)::geography,
  '[]'::jsonb,
  false,
  null,
  'AS', 'Kamrup Metropolitan', true
),
-- 12. Hotel zone — Hotel Polo Towers, Polo Ground, Shillong
(
  '11111111-1111-4111-8111-111111111112',
  'Hotel Polo Towers (Shillong)',
  '{"hi":"होटल पोलो टावर्स"}'::jsonb,
  'Licensed tourist accommodation at Polo Ground, Shillong.',
  'accommodation',
  'none',
  ST_SetSRID(ST_GeomFromGeoJSON($geo$
    {"type":"Polygon","coordinates":[[[91.8915,25.5770],[91.8950,25.5770],[91.8950,25.5802],[91.8915,25.5802],[91.8915,25.5770]]]}
  $geo$), 4326)::geography,
  '[]'::jsonb,
  false,
  null,
  'ML', 'East Khasi Hills', true
),
-- 13. Checkpoint — Jorabat (Assam–Meghalaya gate on GS Road / NH-6)
(
  '11111111-1111-4111-8111-111111111113',
  'Jorabat Checkpoint',
  '{"as":"জোৰাবাট","hi":"जोराबाट चौकी"}'::jsonb,
  'Assam–Meghalaya border check on the Guwahati–Shillong highway. Inner Line / vehicle check.',
  'checkpoint',
  'low',
  ST_SetSRID(ST_GeomFromGeoJSON($geo$
    {"type":"Polygon","coordinates":[[[91.8600,26.0960],[91.8665,26.0960],[91.8665,26.1035],[91.8600,26.1035],[91.8600,26.0960]]]}
  $geo$), 4326)::geography,
  '[]'::jsonb,
  false,
  'Keep passport/ILP ready. Do not queue on the blind curve.',
  'AS', 'Kamrup Metropolitan', true
),
-- 14. Checkpoint — Sela Pass (Tawang road, 4,170 m)
(
  '11111111-1111-4111-8111-111111111114',
  'Sela Pass Checkpoint',
  '{"hi":"सेला दर्रा चौकी"}'::jsonb,
  'Army/ITBP checkpoint on the Bomdila–Tawang road at Sela Pass. Weather and convoy control.',
  'checkpoint',
  'medium',
  ST_SetSRID(ST_GeomFromGeoJSON($geo$
    {"type":"Polygon","coordinates":[[[92.1000,27.5000],[92.1100,27.5000],[92.1100,27.5085],[92.1000,27.5085],[92.1000,27.5000]]]}
  $geo$), 4326)::geography,
  '[]'::jsonb,
  false,
  'Altitude 4,170 m. Report AMS symptoms. Pass closes in blizzard / landslip.',
  'AR', 'Tawang', true
)
on conflict (id) do update set
  name            = excluded.name,
  name_local      = excluded.name_local,
  description     = excluded.description,
  category        = excluded.category,
  risk_level      = excluded.risk_level,
  geom            = excluded.geom,
  time_windows    = excluded.time_windows,
  requires_permit = excluded.requires_permit,
  advisory_text   = excluded.advisory_text,
  state_code      = excluded.state_code,
  district        = excluded.district,
  active          = excluded.active,
  updated_at      = now();
