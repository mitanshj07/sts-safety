-- Issuance policy: Indian tourists verify with Aadhaar (Voter ID / driving
-- licence as equivalent Indian KYC). International tourists verify with a
-- passport. Replaces the Phase-6 placeholder that minted Indian travellers
-- against a passport row.

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
    'aadhaar',
    pgp_sym_encrypt('234123412346', 'dev-only-pii-key'),
    '2346',
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

-- Existing rows: map Indian passports → Aadhaar, foreign non-passports → passport.
update public.tourists
   set kyc_type = 'aadhaar'
 where upper(nationality) = 'IN'
   and kyc_type = 'passport';

update public.tourists
   set kyc_type = 'passport'
 where upper(nationality) <> 'IN'
   and kyc_type <> 'passport';

alter table public.tourists
  drop constraint if exists tourists_kyc_matches_nationality;

alter table public.tourists
  add constraint tourists_kyc_matches_nationality
  check (
    (upper(nationality) = 'IN' and kyc_type in ('aadhaar', 'voter_id', 'driving_licence'))
    or
    (upper(nationality) <> 'IN' and kyc_type = 'passport')
  );

comment on constraint tourists_kyc_matches_nationality on public.tourists is
  'Indian travellers: Aadhaar, or Voter ID / driving licence. International: passport.';
