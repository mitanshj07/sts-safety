-- supabase/migrations/20250101001210_tourist_pwa.sql
-- Tourist PWA helpers: GeoJSON RPCs, itinerary payload, tourist-readable notifications.

-- Zones as a FeatureCollection so the phone can cache polygons for local Turf checks.
create or replace function public.zones_as_geojson()
returns jsonb
language sql
stable
security invoker
set search_path to public, extensions, pg_temp
as $$
  select jsonb_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'type', 'Feature',
          'id', z.id,
          'geometry', ST_AsGeoJSON(z.geom::geometry)::jsonb,
          'properties', jsonb_build_object(
            'id', z.id,
            'name', z.name,
            'category', z.category,
            'risk_level', z.risk_level,
            'advisory_text', z.advisory_text,
            'time_windows', z.time_windows,
            'requires_permit', z.requires_permit
          )
        )
        order by z.name
      ),
      '[]'::jsonb
    )
  )
  from zones z
  where z.active;
$$;

-- Active itinerary for the signed-in tourist (path as GeoJSON LineString).
create or replace function public.my_itinerary_geojson()
returns jsonb
language sql
stable
security invoker
set search_path to public, extensions, app, pg_temp
as $$
  select jsonb_build_object(
    'id', i.id,
    'title', i.title,
    'corridor_m', i.corridor_m,
    'waypoints', i.waypoints,
    'starts_at', i.starts_at,
    'ends_at', i.ends_at,
    'geometry', ST_AsGeoJSON(i.path::geometry)::jsonb
  )
  from itineraries i
  where i.tourist_id = app.my_tourist_id()
    and i.active
  order by i.starts_at desc
  limit 1;
$$;

grant execute on function public.zones_as_geojson() to anon, authenticated, service_role;
grant execute on function public.my_itinerary_geojson() to anon, authenticated, service_role;

-- Tourists must see their own alert history on /alerts (staff policy already exists).
drop policy if exists notifications_tourist_read on notifications;
create policy notifications_tourist_read on notifications for select
  using (
    recipient_id = auth.uid()
    or recipient_id = app.my_tourist_id()
  );

-- Realtime UPDATE payloads for zone redraws while the PWA is open.
alter table zones replica identity full;
