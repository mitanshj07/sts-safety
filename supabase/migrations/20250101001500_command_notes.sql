-- Control-room notes to the SOS tourist land in `notifications`.
-- Publish INSERTs so the PWA can refresh the reply thread without polling.

do $$
begin
  alter publication supabase_realtime add table notifications;
exception
  when duplicate_object then null;
  when undefined_object then
    raise notice 'publication supabase_realtime not present';
end;
$$;
