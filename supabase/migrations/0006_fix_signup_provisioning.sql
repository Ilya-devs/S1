-- ILYA — 0006 fix signup provisioning
-- Apply AFTER 0005_atomic_operations.sql, on a database that already ran
-- 0004_multitenant_saas.sql (which is the normal state for any project that
-- registered a user before this fix existed).
--
-- Bug fixed
-- ---------
-- Registration failed with the generic Supabase Auth error
-- "Database error saving new user" for every second and later signup.
--
-- Root cause
-- ----------
-- public.handle_new_auth_user() (created in 0004), which provisions a new
-- workspace for a brand-new Auth user, ends by inserting one row into
-- public.app_settings for that workspace. That insert fires the
-- trg_force_current_org trigger (also from 0004), whose function
-- public.force_current_org() unconditionally called
-- public.current_organization_id() -- which reads auth.uid(). The Auth
-- signup trigger runs with no JWT/session (auth.uid() is null there), so
-- current_organization_id() returned null and force_current_org() raised
-- 'No active organization', aborting the entire auth.users insert. The same
-- bug is latent in 0004's own "existing users without an organization"
-- backfill script, which runs from the SQL editor with no session either.
--
-- Fix
-- ---
-- public.force_current_org() now only raises on INSERT when there is
-- neither an authenticated organization *nor* an organization_id already
-- provided by the caller. This preserves the original protection for every
-- real client request (an authenticated user can still never insert into a
-- tenant they do not belong to -- see the comment in the function body and
-- in 0004), and only relaxes behavior for the trusted, session-less
-- SECURITY DEFINER paths that legitimately set organization_id themselves.
--
-- This migration is idempotent (CREATE OR REPLACE) and safe to run more
-- than once. It does not delete or modify any business data.

begin;

create or replace function public.force_current_org()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  org uuid := public.current_organization_id();
begin
  if tg_op = 'INSERT' then
    -- Normal path: an authenticated session with an active organization.
    -- Always overwrite organization_id with the caller's real current org so
    -- an authenticated client can never insert a row into a tenant it does
    -- not belong to.
    if org is not null then
      new.organization_id := org;
    elsif new.organization_id is null then
      -- No authenticated session (auth.uid() is null) AND no organization_id
      -- was supplied. This is reachable only by an anonymous/unauthenticated
      -- request, which is already blocked here since it has nothing to work
      -- with.
      raise exception 'No active organization';
    end if;
    -- else: auth.uid() is null (no JWT/session) but organization_id was
    -- already set by the caller. This path is reachable only from trusted,
    -- session-less SECURITY DEFINER server code (e.g. new-user workspace
    -- provisioning run by the Supabase Auth trigger) -- never by a real
    -- client request: every tenant table's own row-level-security policy
    -- independently requires is_org_member(organization_id), which itself
    -- requires auth.uid() to match a real active membership row, so an
    -- anonymous or logged-out request can never pass that check regardless
    -- of what happens here. We therefore trust the organization_id such
    -- trusted code already set.

    if tg_table_name() in (
      'customers','suppliers','products','stock_movements',
      'sales_invoices','purchase_invoices','sales_returns','purchase_returns',
      'debt_payments','expenses'
    ) then
      new.created_by := auth.uid();
    elsif tg_table_name() = 'audit_log' then
      new.actor_id := auth.uid();
    elsif tg_table_name() = 'backup_log' then
      new.triggered_by := auth.uid();
    end if;
  else
    if org is null then
      raise exception 'No active organization';
    end if;
    if new.organization_id is distinct from old.organization_id then
      raise exception 'Changing organization_id is not allowed';
    end if;
  end if;

  return new;
end;
$$;

-- Provision a workspace for any Auth user who signed up while this bug was
-- present and therefore has no organization today (self-healing backfill,
-- same logic as 0004's own backfill script). Safe to run repeatedly: it
-- only inserts for users who still have no active membership.
do $$
declare
  u record;
  org_id uuid;
  base_slug text;
begin
  for u in
    select p.id, p.full_name, au.email
    from public.profiles p
    join auth.users au on au.id = p.id
    where p.is_active
      and not exists (
        select 1 from public.organization_members om where om.user_id = p.id and om.is_active
      )
  loop
    base_slug := regexp_replace(lower(coalesce(split_part(u.email, '@', 1), 'ilya')), '[^a-z0-9]+', '-', 'g');
    base_slug := trim(both '-' from base_slug);
    if base_slug = '' then base_slug := 'ilya'; end if;

    insert into public.organizations(name, slug, owner_id)
    values (
      left(coalesce(u.full_name, 'متجري ILYA'), 160),
      left(base_slug, 40) || '-' || substr(replace(u.id::text, '-', ''), 1, 10),
      u.id
    )
    returning id into org_id;

    insert into public.organization_members(organization_id, user_id, role, is_active)
    values (org_id, u.id, 'owner', true);

    update public.profiles set active_organization_id = org_id, role = 'owner' where id = u.id;

    insert into public.app_settings(organization_id, id, company_name)
    values (org_id, 1, left(coalesce(u.full_name, 'ILYA'), 160))
    on conflict (organization_id, id) do nothing;
  end loop;
end $$;

commit;
