-- supabase/migrations/20250101000500_chain_tables.sql
-- Smart Tourist Safety — blockchain outbox and privileged audit log.
-- On-chain payloads are keccak256 commitments only. No PII.

create table if not exists chain_anchors (
  id            uuid          primary key default gen_random_uuid(),
  kind          anchor_kind   not null,
  subject_id    uuid          not null,          -- incidents.id / digital_ids.id / zones.id
  record_hash   text          not null,          -- 0x… keccak256 of the canonical record
  chain_id      integer       not null,
  contract_address text,
  tx_hash       text,
  block_number  bigint,
  status        anchor_status not null default 'pending',
  attempts      smallint      not null default 0,
  error         text,
  created_at    timestamptz   not null default now(),
  confirmed_at  timestamptz
);

create index if not exists chain_anchors_pending on chain_anchors (created_at)
  where status in ('pending', 'failed');

create table if not exists audit_log (
  id          bigserial   primary key,
  actor_id    uuid,
  actor_role  user_role,
  action      text        not null,
  entity      text        not null,
  entity_id   text,
  before      jsonb,
  after       jsonb,
  ip          inet,
  created_at  timestamptz not null default now()
);
