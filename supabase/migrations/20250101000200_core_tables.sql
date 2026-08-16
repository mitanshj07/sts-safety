-- supabase/migrations/20250101000200_core_tables.sql
-- Smart Tourist Safety — people & identity.
-- PII lives here and ONLY here. Never on-chain.

-- Application-level profile, 1:1 with auth.users
create table if not exists profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  role            user_role   not null default 'tourist',
  display_name    text        not null,
  phone_e164      text,
  locale          text        not null default 'en',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Tourists. PII lives here and ONLY here. Never on-chain.
create table if not exists tourists (
  id                  uuid primary key default gen_random_uuid(),
  profile_id          uuid unique references profiles(id) on delete set null,

  -- Identity (PII)
  full_name           text        not null,
  nationality         text        not null default 'IN',   -- ISO 3166-1 alpha-2
  date_of_birth       date,
  kyc_type            kyc_type    not null,
  kyc_number_enc      bytea       not null,   -- pgp_sym_encrypt(kyc_number, key)
  kyc_last4           text,                   -- for operator-side visual confirmation only
  kyc_salt            bytea       not null default gen_random_bytes(32),
  photo_path          text,                   -- Supabase Storage key

  -- Contact & emergency
  phone_e164          text,
  email               text,
  emergency_contacts  jsonb       not null default '[]'::jsonb,
    -- [{ name, relation, phone_e164, email, notify: true }]

  -- Trip window
  trip_start          timestamptz not null,
  trip_end            timestamptz not null,
  entry_point         text,                   -- e.g. 'Guwahati LGBI Airport'

  -- Derived / cached state (kept hot for the dashboard)
  safety_score        smallint    not null default 100
                        check (safety_score between 0 and 100),
  last_geog           geography(Point, 4326),
  last_ping_at        timestamptz,
  current_zone_ids    uuid[]      not null default '{}',
  tracking_enabled    boolean     not null default true,
  hd_index            integer     unique,     -- BIP-44 derivation index for this tourist
  wallet_address      text,                   -- 0x… derived, custodial

  status              text        not null default 'active',   -- active | checked_out | inactive
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint trip_window_valid check (trip_end > trip_start)
);

comment on column tourists.kyc_salt is
  'Random per-tourist salt. keccak256(kyc_type || kyc_number || salt) is the on-chain commitment. Without this salt the on-chain value is unlinkable to any person — this is what keeps the design DPDP Act 2023 compliant.';

-- Blockchain-backed digital identity credential (commitments only, never PII)
create table if not exists digital_ids (
  id                uuid primary key default gen_random_uuid(),
  tourist_id        uuid        not null references tourists(id) on delete cascade,

  chain_id          integer     not null,          -- 80002 = Polygon Amoy, 31337 = Anvil
  contract_address  text        not null,
  token_id          numeric(78,0),                 -- uint256
  holder_address    text        not null,

  kyc_commitment    text        not null,          -- 0x… keccak256, 66 chars
  itinerary_hash    text,                          -- 0x… keccak256 of canonical itinerary
  metadata_uri      text,
  vc_path           text,                          -- Storage key of the signed W3C VC
  vc_sha256         text,

  valid_from        timestamptz not null,
  valid_until       timestamptz not null,
  status            id_status   not null default 'pending',
  revocation_reason text,

  issue_tx_hash     text,
  issue_block       bigint,
  revoke_tx_hash    text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  unique (chain_id, contract_address, token_id)
);

-- Only one active credential per tourist at a time
create unique index if not exists digital_ids_one_active
  on digital_ids (tourist_id)
  where status = 'active';

-- Planned route. Geography column requires PostGIS (enabled in 000000).
create table if not exists itineraries (
  id            uuid primary key default gen_random_uuid(),
  tourist_id    uuid        not null references tourists(id) on delete cascade,
  title         text        not null default 'Planned route',
  path          geography(LineString, 4326) not null,
  corridor_m    integer     not null default 2000,   -- allowed deviation before flagging
  waypoints     jsonb       not null default '[]'::jsonb,
    -- [{ name, lat, lon, eta, dwell_minutes, checkin_required }]
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  active        boolean     not null default true,
  created_at    timestamptz not null default now()
);
