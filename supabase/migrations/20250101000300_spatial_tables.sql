-- supabase/migrations/20250101000300_spatial_tables.sql
-- Smart Tourist Safety — geofence polygons and location telemetry.
-- Generated columns cast geography → geometry (PostGIS has no geography centroid).

create table if not exists zones (
  id              uuid primary key default gen_random_uuid(),
  name            text          not null,
  name_local      jsonb         not null default '{}'::jsonb,   -- { "as": "...", "hi": "..." }
  description     text,
  category        zone_category not null,
  risk_level      risk_level    not null default 'low',

  geom            geography(Polygon, 4326) not null,
  centroid        geography(Point, 4326)
                    generated always as (ST_Centroid(geom::geometry)::geography) stored,
  area_sqm        double precision
                    generated always as (ST_Area(geom)) stored,

  -- Time-based rules: a forest reserve may be safe at noon and restricted at night
  time_windows    jsonb         not null default '[]'::jsonb,
    -- [{ "days":[0,1,2,3,4,5,6], "from":"05:30", "to":"17:30", "risk_level":"low" }]
  requires_permit boolean       not null default false,
  advisory_text   text,

  state_code      text,          -- AS, ML, AR, NL, MN, MZ, TR, SK
  district        text,
  active          boolean       not null default true,
  created_by      uuid          references profiles(id),
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now(),

  constraint zone_geom_valid  check (ST_IsValid(geom::geometry)),
  -- guards against a fat-fingered polygon covering half of India
  constraint zone_area_sane   check (ST_Area(geom) < 5e10)
);

-- High-volume, short-retention raw telemetry.
create table if not exists location_pings (
  id            bigserial   primary key,
  tourist_id    uuid        not null references tourists(id) on delete cascade,
  geog          geography(Point, 4326) not null,
  accuracy_m    real,
  altitude_m    real,
  speed_mps     real,
  heading_deg   real,
  battery_pct   smallint check (battery_pct between 0 and 100),
  source        ping_source not null default 'phone',
  is_mock       boolean     not null default false,   -- Android mock-location flag
  recorded_at   timestamptz not null,
  created_at    timestamptz not null default now()
);

-- Downsampled long-term history: one LineString per tourist per hour.
-- This is what keeps the free-tier 500 MB budget viable.
create table if not exists location_tracks (
  id            bigserial   primary key,
  tourist_id    uuid        not null references tourists(id) on delete cascade,
  path          geography(LineString, 4326) not null,
  bucket_start  timestamptz not null,
  bucket_end    timestamptz not null,
  point_count   integer     not null,
  distance_m    double precision,
  unique (tourist_id, bucket_start)
);
