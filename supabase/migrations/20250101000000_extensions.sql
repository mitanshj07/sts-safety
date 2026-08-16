-- supabase/migrations/20250101000000_extensions.sql
-- Smart Tourist Safety — Postgres extensions and the app schema.
-- Target: Supabase free tier (Postgres 15 + PostGIS 3)

create extension if not exists postgis;
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

-- pg_cron / pg_net are on the allow-list in hosted Supabase and in the
-- local supabase/postgres image. Guarded so a stripped Postgres still
-- applies the rest of the schema (cron.sql is also guarded).
do $$
begin
  create extension if not exists pg_cron;
  grant usage on schema cron to postgres;
  grant all privileges on all tables in schema cron to postgres;
exception
  when undefined_file or feature_not_supported or insufficient_privilege then
    raise notice 'pg_cron not available: %', sqlerrm;
end;
$$;

do $$
begin
  create extension if not exists pg_net;
exception
  when undefined_file or feature_not_supported or insufficient_privilege then
    raise notice 'pg_net not available: %', sqlerrm;
end;
$$;

create schema if not exists app;

grant usage on schema app to postgres, anon, authenticated, service_role;
grant usage on schema public to postgres, anon, authenticated, service_role;

alter default privileges in schema app
  grant execute on functions to postgres, anon, authenticated, service_role;
