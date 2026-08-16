-- supabase/migrations/20250101001100_views.sql
-- Smart Tourist Safety — operator views (also the NL→SQL allow-list).
-- security_invoker: honour RLS on the underlying tables (PG 15+).

create or replace view v_live_tourists
with (security_invoker = true) as
select t.id, t.full_name, t.nationality, t.safety_score, t.last_ping_at,
       ST_Y(t.last_geog::geometry) as lat,
       ST_X(t.last_geog::geometry) as lon,
       t.current_zone_ids,
       d.token_id, d.status as id_status,
       (select count(*) from incidents i
         where i.tourist_id = t.id and i.status in ('open','acknowledged','dispatched')) as open_incidents
  from tourists t
  left join digital_ids d on d.tourist_id = t.id and d.status = 'active'
 where t.status = 'active';

create or replace view v_open_incidents
with (security_invoker = true) as
select i.id, i.type, i.severity, i.status, i.occurred_at, i.ai_brief,
       i.address_text, i.anomaly_score,
       ST_Y(i.geog::geometry) as lat, ST_X(i.geog::geometry) as lon,
       t.full_name as tourist_name, t.nationality, t.phone_e164,
       z.name as zone_name, z.category as zone_category,
       ca.tx_hash as anchor_tx, ca.status as anchor_status
  from incidents i
  left join tourists t on t.id = i.tourist_id
  left join zones z on z.id = i.zone_id
  left join chain_anchors ca on ca.subject_id = i.id and ca.kind = 'incident'
 where i.status in ('open','acknowledged','dispatched')
 order by
   case i.severity when 'critical' then 0 when 'high' then 1
                   when 'medium' then 2 else 3 end,
   i.occurred_at desc;

create or replace view v_zone_risk_ranking
with (security_invoker = true) as
select z.id, z.name, z.category, z.risk_level, z.district, z.state_code,
       count(i.id) as incident_count_30d,
       count(*) filter (where i.severity in ('high','critical')) as severe_count_30d
  from zones z
  left join incidents i on i.zone_id = z.id and i.occurred_at > now() - interval '30 days'
 group by z.id
 order by severe_count_30d desc, incident_count_30d desc;

grant select on v_live_tourists, v_open_incidents, v_zone_risk_ranking
  to anon, authenticated, service_role;
