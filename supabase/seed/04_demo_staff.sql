-- supabase/seed/04_demo_staff.sql
-- Control-room admin + one on-duty officer. Password matches tourist seed: DemoPass123!
-- Relies on app.seed_demo_auth_user from 03_demo_tourists.sql.

select app.seed_demo_auth_user(
  '33333333-3333-4333-8333-3333333333a1',
  'admin@demo.sts', 'DemoPass123!', 'Control Room Admin');

select app.seed_demo_auth_user(
  '33333333-3333-4333-8333-3333333333b1',
  'officer@demo.sts', 'DemoPass123!', 'SI Baruah');

insert into profiles (id, role, display_name, locale)
values
  ('33333333-3333-4333-8333-3333333333a1', 'admin'::user_role, 'Control Room Admin', 'en'),
  ('33333333-3333-4333-8333-3333333333b1', 'responder'::user_role, 'SI Baruah', 'en')
on conflict (id) do update set
  role         = excluded.role,
  display_name = excluded.display_name;

update responders
   set profile_id = '33333333-3333-4333-8333-3333333333b1'
 where id = '21111111-1111-4111-8111-111111111101';
