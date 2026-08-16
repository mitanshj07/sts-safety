-- supabase/migrations/20250101000100_enums.sql
-- Smart Tourist Safety — enumerated types.
-- CREATE TYPE is not IF-NOT-EXISTS; wrap for a clean re-apply after reset.

do $$ begin
  create type user_role as enum ('tourist', 'responder', 'admin', 'auditor');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type kyc_type as enum ('passport', 'aadhaar', 'voter_id', 'driving_licence');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type id_status as enum ('pending', 'active', 'expired', 'revoked', 'suspended');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type zone_category as enum (
    'safe', 'caution', 'restricted', 'high_risk',
    'border', 'forest_reserve', 'accommodation',
    'checkpoint', 'medical'
  );
exception when duplicate_object then null;
end $$;

-- Declaration order is the comparison order used by evaluate_position().
do $$ begin
  create type risk_level as enum ('none', 'low', 'medium', 'high', 'critical');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type ping_source as enum ('phone', 'band', 'simulator', 'manual');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type incident_type as enum (
    'sos',
    'geofence_entry_restricted',
    'geofence_exit_safe',
    'zone_time_violation',
    'route_deviation',
    'signal_lost',
    'prolonged_inactivity',
    'implausible_speed',
    'anomaly_ml',
    'battery_critical',
    'missed_checkin',
    'manual_report'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type severity_level as enum ('info', 'low', 'medium', 'high', 'critical');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type incident_status as enum (
    'open', 'acknowledged', 'dispatched',
    'resolved', 'false_positive', 'expired'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type detection_source as enum ('rules', 'ml', 'rules+ml', 'manual', 'device');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type dispatch_status as enum (
    'sent', 'acknowledged', 'en_route',
    'on_scene', 'completed', 'declined', 'timeout'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type notify_channel as enum ('webpush', 'telegram', 'email', 'realtime', 'sms');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type notify_status as enum ('queued', 'sent', 'delivered', 'failed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type anchor_kind as enum (
    'id_issue', 'id_revoke', 'id_extend',
    'incident', 'incident_resolution', 'efir', 'zone_definition'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type anchor_status as enum ('pending', 'submitted', 'confirmed', 'failed');
exception when duplicate_object then null;
end $$;
