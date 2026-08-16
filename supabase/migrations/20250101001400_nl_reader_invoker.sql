-- Operator views use security_invoker, so SET ROLE nl_reader also needs
-- SELECT on the underlying tables plus RLS policies. Without these grants
-- NL→SQL fails with "permission denied for table incidents".

do $$
begin
  grant select on table
    public.incidents,
    public.tourists,
    public.zones,
    public.chain_anchors,
    public.digital_ids
    to nl_reader;
exception when undefined_object then
  raise notice 'nl_reader missing; skip table grants';
end;
$$;

do $$
begin
  drop policy if exists nl_reader_incidents on public.incidents;
  create policy nl_reader_incidents on public.incidents
    for select to nl_reader using (true);

  drop policy if exists nl_reader_tourists on public.tourists;
  create policy nl_reader_tourists on public.tourists
    for select to nl_reader using (true);

  drop policy if exists nl_reader_zones on public.zones;
  create policy nl_reader_zones on public.zones
    for select to nl_reader using (true);

  drop policy if exists nl_reader_chain_anchors on public.chain_anchors;
  create policy nl_reader_chain_anchors on public.chain_anchors
    for select to nl_reader using (true);

  drop policy if exists nl_reader_digital_ids on public.digital_ids;
  create policy nl_reader_digital_ids on public.digital_ids
    for select to nl_reader using (true);
exception when undefined_object then
  raise notice 'nl_reader missing; skip RLS policies';
end;
$$;
