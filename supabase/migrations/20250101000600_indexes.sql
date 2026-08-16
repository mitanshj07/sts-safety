-- supabase/migrations/20250101000600_indexes.sql
-- Smart Tourist Safety — GiST (spatial), BRIN (time), and lookup indexes.

-- Spatial (GiST) — these are what make geofencing sub-millisecond
create index if not exists zones_geom_gix          on zones            using gist (geom);
create index if not exists zones_active_gix        on zones            using gist (geom) where active;
create index if not exists itineraries_path_gix    on itineraries      using gist (path);
create index if not exists pings_geog_gix          on location_pings   using gist (geog);
create index if not exists tracks_path_gix         on location_tracks  using gist (path);
create index if not exists incidents_geog_gix      on incidents        using gist (geog);
create index if not exists responders_base_gix     on responders       using gist (base_geog);
create index if not exists responders_last_gix     on responders       using gist (last_geog) where on_duty;
create index if not exists tourists_last_geog_gix  on tourists         using gist (last_geog);

-- Temporal / lookup
create index if not exists pings_tourist_time      on location_pings (tourist_id, recorded_at desc);
create index if not exists pings_recorded_brin     on location_pings using brin (recorded_at);
create index if not exists incidents_status_time   on incidents (status, occurred_at desc);
create index if not exists incidents_tourist_time  on incidents (tourist_id, occurred_at desc);
create index if not exists incidents_severity      on incidents (severity, status) where status = 'open';
create index if not exists dispatches_incident     on dispatches (incident_id);
create index if not exists notifications_incident  on notifications (incident_id);
create index if not exists tourists_active_trip    on tourists (trip_start, trip_end) where status = 'active';
create index if not exists tourists_stale_ping     on tourists (last_ping_at) where tracking_enabled;
