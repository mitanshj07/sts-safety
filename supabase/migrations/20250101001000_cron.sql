-- supabase/migrations/20250101001000_cron.sql
-- Smart Tourist Safety — pg_cron sweepers. Skipped if pg_cron is not installed.

do $cron$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron not installed; skipping scheduled jobs';
    return;
  end if;

  perform cron.unschedule(j.jobid)
    from cron.job j
   where j.jobname in (
     'sts-signal-loss',
     'sts-inactivity',
     'sts-downsample',
     'sts-retention',
     'sts-anchor-retry'
   );

  -- Signal-loss sweeper: every minute
  perform cron.schedule('sts-signal-loss', '* * * * *', $job$
    select app.raise_incident(t.id, 'signal_lost', t.last_geog, null, 'medium',
             jsonb_build_object('silence_minutes',
               round(extract(epoch from (now() - t.last_ping_at))/60))
           )
      from tourists t
     where t.status = 'active' and t.tracking_enabled
       and now() between t.trip_start and t.trip_end
       and t.last_ping_at is not null
       and t.last_ping_at < now() - interval '20 minutes';
  $job$);

  -- Prolonged inactivity: every 5 minutes
  -- ST_MaxDistance / ST_Collect operate on geometry — cast geography explicitly.
  perform cron.schedule('sts-inactivity', '*/5 * * * *', $job$
    select app.raise_incident(t.id, 'prolonged_inactivity', t.last_geog, null, 'medium',
             jsonb_build_object('stationary_minutes', 45))
      from tourists t
     where t.status = 'active'
       and t.last_geog is not null
       and t.last_ping_at > now() - interval '5 minutes'
       and not exists (
         select 1 from app.zones_at(t.last_geog) z
          where z.category in ('accommodation','medical','checkpoint'))
       and (select ST_MaxDistance(
                     ST_Collect(p.geog::geometry),
                     t.last_geog::geometry)
              from location_pings p
             where p.tourist_id = t.id
               and p.recorded_at > now() - interval '45 minutes') < 50;
  $job$);

  -- Downsample raw pings into hourly LineStrings: every 10 minutes
  -- ST_MakeLine is geometry-only; cast back to geography for storage.
  perform cron.schedule('sts-downsample', '*/10 * * * *', $job$
    insert into location_tracks (tourist_id, path, bucket_start, bucket_end, point_count, distance_m)
    select p.tourist_id,
           ST_MakeLine(p.geog::geometry order by p.recorded_at)::geography,
           date_trunc('hour', min(p.recorded_at)),
           date_trunc('hour', min(p.recorded_at)) + interval '1 hour',
           count(*)::integer,
           ST_Length(ST_MakeLine(p.geog::geometry order by p.recorded_at)::geography)
      from location_pings p
     where p.recorded_at < date_trunc('hour', now())
       and p.recorded_at > date_trunc('hour', now()) - interval '3 hours'
     group by p.tourist_id, date_trunc('hour', p.recorded_at)
    having count(*) > 1
    on conflict (tourist_id, bucket_start) do nothing;
  $job$);

  -- Retention: keep raw pings 24 h. This is the free-tier storage guard.
  perform cron.schedule('sts-retention', '17 * * * *', $job$
    delete from location_pings where recorded_at < now() - interval '24 hours';
  $job$);

  -- Retry failed blockchain anchors: every 2 minutes.
  -- No-ops when app.anchor_retry_url is unset; never blocks the safety path.
  perform cron.schedule('sts-anchor-retry', '*/2 * * * *', $job$
    select net.http_post(
      url := current_setting('app.anchor_retry_url', true),
      headers := jsonb_build_object('Content-Type','application/json',
                                    'x-pipeline-secret', coalesce(current_setting('app.pipeline_secret', true), '')),
      body := jsonb_build_object('anchor_id', a.id))
      from chain_anchors a
     where a.status in ('pending','failed') and a.attempts < 5
       and coalesce(current_setting('app.anchor_retry_url', true), '') <> ''
     limit 10;
  $job$);
end;
$cron$;
