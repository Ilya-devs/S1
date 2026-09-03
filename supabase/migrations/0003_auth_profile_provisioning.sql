-- ILYA Accounting — 0003 auth/profile provisioning
-- Apply AFTER 0002_hardening.sql.
-- Creates a profiles row automatically whenever a Supabase Auth user is created.
-- Existing Auth users without profiles are backfilled safely.

begin;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  assigned_role public.user_role;
  display_name text;
begin
  -- First application user becomes owner; later self-registered users are viewers.
  -- Existing profiles are never modified by this trigger.
  if exists (select 1 from public.profiles limit 1) then
    assigned_role := 'viewer';
  else
    assigned_role := 'owner';
  end if;

  display_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(new.email, '@', 1),
    'مستخدم ILYA'
  );

  insert into public.profiles (id, full_name, role, is_active)
  values (new.id, left(display_name, 200), assigned_role, true)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Backfill Auth users that were created before this migration.
-- If there are no profiles yet, the oldest Auth user becomes owner.
with missing_users as (
  select
    u.id,
    coalesce(
      nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
      split_part(u.email, '@', 1),
      'مستخدم ILYA'
    ) as full_name,
    row_number() over (order by u.created_at, u.id) as rn
  from auth.users u
  left join public.profiles p on p.id = u.id
  where p.id is null
),
profile_count as (
  select count(*)::int as total from public.profiles
)
insert into public.profiles (id, full_name, role, is_active)
select
  m.id,
  left(m.full_name, 200),
  case when pc.total = 0 and m.rn = 1 then 'owner'::public.user_role else 'viewer'::public.user_role end,
  true
from missing_users m
cross join profile_count pc
on conflict (id) do nothing;

commit;
