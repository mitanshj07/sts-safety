-- supabase/migrations/20250101001190_auth_profile.sql
-- Auth hooks: create profiles on first sign-in, demo-tourist provision,
-- SELECT 1 health probe. Trigger is the source of truth; TS ensure-profile
-- is the fallback when the trigger is skipped (e.g. identity linking).
-- Version 01190 so it does not collide with Phase 6/7 01200 migrations.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to public, extensions, pg_temp
as $$
declare
  v_role user_role := 'tourist';
  v_name text;
begin
  begin
    v_role := coalesce(nullif(new.raw_user_meta_data->>'role', '')::user_role, 'tourist');
  exception when others then
    v_role := 'tourist';
  end;

  -- Anonymous users have no email. Never coerce a blank email into a name.
  v_name := coalesce(
    nullif(new.raw_user_meta_data->>'display_name', ''),
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Demo Tourist'
  );

  insert into public.profiles (id, role, display_name, locale)
  values (
    new.id,
    v_role,
    v_name,
    coalesce(nullif(new.raw_user_meta_data->>'locale', ''), 'en')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep non-staff from promoting themselves via a profiles UPDATE.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path to public, extensions, app, pg_temp
as $$
begin
  -- Seed / service-role / trigger context has no JWT. Only lock the role
  -- when a real end-user is updating their own row.
  if auth.uid() is not null
     and new.role is distinct from old.role
     and coalesce(auth.role(), '') <> 'service_role'
     and not app.is_staff() then
    new.role := old.role;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_protect_profile_role on profiles;
create trigger trg_protect_profile_role
  before update on profiles
  for each row execute function public.protect_profile_role();

-- Authenticated users may insert their own tourist-role profile if the
-- trigger did not fire. Role self-upgrade is blocked by the WITH CHECK.
drop policy if exists profiles_self_insert on profiles;
create policy profiles_self_insert on profiles
  for insert
  with check (id = auth.uid() and role = 'tourist'::user_role);

-- Provision a tourists row for anonymous (no-email) demo sign-ins.
-- KYC is a placeholder; onboarding (Phase 6) replaces it.
create or replace function public.ensure_demo_tourist(p_profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path to public, extensions, pg_temp
as $$
declare
  v_id uuid;
  v_name text;
begin
  if coalesce(auth.role(), '') <> 'service_role'
     and p_profile_id is distinct from auth.uid() then
    raise exception 'not allowed';
  end if;

  insert into public.profiles (id, role, display_name, locale)
  values (p_profile_id, 'tourist', 'Demo Tourist', 'en')
  on conflict (id) do nothing;

  select id into v_id from public.tourists where profile_id = p_profile_id;
  if v_id is not null then
    return v_id;
  end if;

  select display_name into v_name from public.profiles where id = p_profile_id;

  insert into public.tourists (
    profile_id, full_name, nationality,
    kyc_type, kyc_number_enc, kyc_last4,
    email, trip_start, trip_end, entry_point, status
  ) values (
    p_profile_id,
    coalesce(nullif(v_name, ''), 'Demo Tourist'),
    'IN',
    'passport',
    pgp_sym_encrypt('DEMO-ANON', 'dev-only-pii-key'),
    'ANON',
    null,
    now(),
    now() + interval '7 days',
    'Guwahati LGBI Airport',
    'active'
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.health_ping()
returns integer
language sql
stable
security definer
set search_path to public, pg_temp
as $$
  select 1;
$$;

grant execute on function public.handle_new_user() to postgres, service_role;
grant execute on function public.protect_profile_role() to postgres, authenticated, service_role;
grant execute on function public.ensure_demo_tourist(uuid) to authenticated, service_role;
grant execute on function public.health_ping() to anon, authenticated, service_role;
