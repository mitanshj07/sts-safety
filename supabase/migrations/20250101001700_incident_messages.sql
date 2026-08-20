-- Two-way SOS thread: optional tourist text + voice notes (Supabase Storage, no paid STT/TTS).
-- Audio lives in a private 1 MiB bucket; metadata is append-only like incident_events.

create table if not exists incident_messages (
  id            uuid        primary key default gen_random_uuid(),
  incident_id   uuid        not null references incidents(id) on delete cascade,
  sender_kind   text        not null check (sender_kind in ('tourist', 'command')),
  sender_id     uuid,
  kind          text        not null check (kind in ('text', 'voice')),
  body          text,
  storage_path  text,
  mime_type     text,
  duration_ms   integer     check (duration_ms is null or (duration_ms >= 0 and duration_ms <= 60000)),
  byte_size     integer     check (byte_size is null or (byte_size >= 0 and byte_size <= 1048576)),
  created_at    timestamptz not null default now(),
  constraint incident_messages_payload_ck check (
    (kind = 'text' and coalesce(length(trim(body)), 0) > 0)
    or (kind = 'voice' and storage_path is not null)
  )
);

create index if not exists incident_messages_incident_created_idx
  on incident_messages (incident_id, created_at);

grant select, insert on table incident_messages to anon, authenticated, service_role;
alter table incident_messages enable row level security;
alter table incident_messages replica identity full;

drop policy if exists incident_messages_read on incident_messages;
drop policy if exists incident_messages_insert_tourist on incident_messages;
drop policy if exists incident_messages_insert_staff on incident_messages;

create policy incident_messages_read on incident_messages for select
  using (
    app.is_staff()
    or exists (
      select 1 from incidents i
       where i.id = incident_id
         and i.tourist_id = app.my_tourist_id()
    )
  );

create policy incident_messages_insert_tourist on incident_messages for insert
  with check (
    sender_kind = 'tourist'
    and exists (
      select 1 from incidents i
       where i.id = incident_id
         and i.tourist_id = app.my_tourist_id()
    )
  );

create policy incident_messages_insert_staff on incident_messages for insert
  with check (app.is_staff());

do $$
begin
  alter publication supabase_realtime add table incident_messages;
exception
  when duplicate_object then null;
  when undefined_object then
    raise notice 'publication supabase_realtime not present';
end;
$$;

-- Private voice bucket. Uploads go through the Next.js route (service role);
-- the 1 MiB cap is the free-tier guard. MIME is validated in the app so
-- MediaRecorder's `audio/webm;codecs=opus` is not rejected by an exact-match list.
insert into storage.buckets (id, name, public, file_size_limit)
values ('incident-voice', 'incident-voice', false, 1048576)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

-- Copy the optional SOS line into the thread so command and tourist share one timeline.
create or replace function app.copy_sos_tourist_message()
returns trigger
language plpgsql
security definer
set search_path to public, extensions, app, pg_temp
as $$
declare
  msg text;
begin
  if NEW.type is distinct from 'sos' then
    return NEW;
  end if;
  msg := nullif(btrim(NEW.payload->>'tourist_message'), '');
  if msg is null then
    return NEW;
  end if;
  insert into incident_messages (incident_id, sender_kind, sender_id, kind, body)
  values (NEW.id, 'tourist', NEW.tourist_id, 'text', left(msg, 280));
  return NEW;
end;
$$;

drop trigger if exists trg_copy_sos_tourist_message on incidents;
create trigger trg_copy_sos_tourist_message
  after insert on incidents
  for each row
  execute function app.copy_sos_tourist_message();
