-- supabase/migrations/20250101000800_triggers.sql
-- Smart Tourist Safety — AFTER INSERT hot path. Postgres 15: EXECUTE FUNCTION.

drop trigger if exists trg_evaluate_position on location_pings;
create trigger trg_evaluate_position
  after insert on location_pings
  for each row execute function app.evaluate_position();

drop trigger if exists trg_notify_incident_pipeline on incidents;
create trigger trg_notify_incident_pipeline
  after insert on incidents
  for each row execute function app.notify_incident_pipeline();
