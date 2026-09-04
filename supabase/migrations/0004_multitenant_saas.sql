-- ILYA SaaS — 0004 multi-tenant foundation
-- Apply AFTER 0003_auth_profile_provisioning.sql.
-- Converts the legacy single-store schema into isolated organizations.
-- Existing business data is migrated into one legacy organization.
-- New Auth users receive a private organization + owner membership automatically.
-- All tenant reads/writes are enforced by RLS; client-supplied organization_id is ignored on insert.

begin;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.user_role not null default 'viewer',
  is_active boolean not null default true,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index if not exists idx_org_members_user on public.organization_members(user_id, is_active);
create index if not exists idx_org_members_org on public.organization_members(organization_id, is_active);

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.user_role not null default 'cashier',
  token_hash text not null unique,
  invited_by uuid not null references public.profiles(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_org_invites_org on public.organization_invitations(organization_id, created_at desc);
create index if not exists idx_org_invites_email on public.organization_invitations(lower(email));

alter table public.profiles
  add column if not exists active_organization_id uuid references public.organizations(id) on delete set null;

-- Tenant-owned tables.
do $$
declare
  t text;
begin
  foreach t in array array[
    'app_settings','customers','suppliers','product_categories','products',
    'stock_movements','sales_invoices','sales_invoice_items',
    'purchase_invoices','purchase_invoice_items','sales_returns','sales_return_items',
    'purchase_returns','purchase_return_items','debt_payments',
    'expense_categories','expenses','audit_log','notifications','backup_log'
  ] loop
    execute format('alter table public.%I add column if not exists organization_id uuid', t);
  end loop;
end $$;

-- Create one legacy organization for existing data.
do $$
declare
  legacy_owner uuid;
  legacy_org uuid;
begin
  select id into legacy_owner
  from public.profiles
  order by case when role = 'owner' then 0 else 1 end, created_at, id
  limit 1;

  if legacy_owner is not null and not exists (select 1 from public.organizations) then
    insert into public.organizations(name, slug, owner_id)
    values ('ILYA — المتجر الرئيسي', 'legacy-' || substr(replace(legacy_owner::text,'-',''),1,12), legacy_owner)
    returning id into legacy_org;

    insert into public.organization_members(organization_id, user_id, role, is_active)
    select legacy_org, p.id, p.role, p.is_active
    from public.profiles p
    on conflict do nothing;

    update public.profiles
      set active_organization_id = legacy_org
    where active_organization_id is null;

    -- Move all existing tenant data into the legacy organization.
    update public.app_settings set organization_id = legacy_org where organization_id is null;
    update public.customers set organization_id = legacy_org where organization_id is null;
    update public.suppliers set organization_id = legacy_org where organization_id is null;
    update public.product_categories set organization_id = legacy_org where organization_id is null;
    update public.products set organization_id = legacy_org where organization_id is null;
    update public.sales_invoices set organization_id = legacy_org where organization_id is null;
    update public.purchase_invoices set organization_id = legacy_org where organization_id is null;
    update public.sales_returns set organization_id = legacy_org where organization_id is null;
    update public.purchase_returns set organization_id = legacy_org where organization_id is null;
    update public.debt_payments set organization_id = legacy_org where organization_id is null;
    update public.expense_categories set organization_id = legacy_org where organization_id is null;
    update public.expenses set organization_id = legacy_org where organization_id is null;
    update public.audit_log set organization_id = legacy_org where organization_id is null;
    update public.backup_log set organization_id = legacy_org where organization_id is null;

    update public.sales_invoice_items i
      set organization_id = h.organization_id
      from public.sales_invoices h
      where i.invoice_id = h.id and i.organization_id is null;

    update public.purchase_invoice_items i
      set organization_id = h.organization_id
      from public.purchase_invoices h
      where i.invoice_id = h.id and i.organization_id is null;

    update public.sales_return_items i
      set organization_id = h.organization_id
      from public.sales_returns h
      where i.return_id = h.id and i.organization_id is null;

    update public.purchase_return_items i
      set organization_id = h.organization_id
      from public.purchase_returns h
      where i.return_id = h.id and i.organization_id is null;

    update public.stock_movements sm
      set organization_id = coalesce(
        (select si.organization_id from public.sales_invoices si where si.id = sm.reference_id and sm.reference_table = 'sales_invoices'),
        (select pi.organization_id from public.purchase_invoices pi where pi.id = sm.reference_id and sm.reference_table = 'purchase_invoices'),
        (select sr.organization_id from public.sales_returns sr where sr.id = sm.reference_id and sm.reference_table = 'sales_returns'),
        (select pr.organization_id from public.purchase_returns pr where pr.id = sm.reference_id and sm.reference_table = 'purchase_returns'),
        legacy_org
      )
    where sm.organization_id is null;

    update public.notifications set organization_id = legacy_org where organization_id is null;
  end if;
end $$;

-- If profiles exist but had no active org (e.g. partially migrated DB), attach them.
do $$
declare
  fallback_org uuid;
begin
  select id into fallback_org from public.organizations order by created_at limit 1;
  if fallback_org is not null then
    update public.profiles set active_organization_id = fallback_org
    where active_organization_id is null
      and exists (select 1 from public.organization_members om where om.organization_id = fallback_org and om.user_id = profiles.id);
  end if;
end $$;

-- New users: create a private workspace and owner membership.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  org_id uuid;
  assigned_role public.user_role := 'owner';
  base_slug text;
  final_slug text;
  display_name text;
  pending_inv public.organization_invitations;
begin
  display_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(new.email, '@', 1), ''),
    'مستخدم ILYA'
  );

  -- If the email was invited before signup, join that workspace instead of
  -- creating an unused personal workspace. Possession of the invited email
  -- is established by Supabase Auth/email verification.
  select * into pending_inv
  from public.organization_invitations
  where lower(email) = lower(new.email)
    and accepted_at is null
    and expires_at > now()
  order by created_at desc
  limit 1;

  if pending_inv.id is not null then
    org_id := pending_inv.organization_id;
    assigned_role := pending_inv.role;

    insert into public.profiles (id, full_name, role, is_active)
    values (new.id, left(display_name, 200), assigned_role, true)
    on conflict (id) do update
      set full_name = excluded.full_name,
          is_active = true,
          role = excluded.role;

    insert into public.organization_members(organization_id, user_id, role, is_active)
    values (org_id, new.id, assigned_role, true)
    on conflict (organization_id, user_id) do update
      set role = excluded.role, is_active = true;

    update public.profiles
      set active_organization_id = org_id, role = assigned_role
    where id = new.id;

    return new;
  end if;

  insert into public.profiles (id, full_name, role, is_active)
  values (new.id, left(display_name, 200), 'owner', true)
  on conflict (id) do update
    set full_name = excluded.full_name,
        is_active = true;

  base_slug := regexp_replace(
    lower(coalesce(split_part(new.email, '@', 1), 'ilya')),
    '[^a-z0-9]+', '-', 'g'
  );
  base_slug := trim(both '-' from base_slug);
  if base_slug = '' then base_slug := 'ilya'; end if;
  final_slug := left(base_slug, 40) || '-' || substr(replace(new.id::text,'-',''),1,10);

  insert into public.organizations(name, slug, owner_id)
  values (left(display_name, 160), final_slug, new.id)
  returning id into org_id;

  insert into public.organization_members(organization_id, user_id, role, is_active)
  values (org_id, new.id, 'owner', true)
  on conflict (organization_id, user_id) do update
    set role = 'owner', is_active = true;

  update public.profiles
    set active_organization_id = org_id, role = 'owner'
  where id = new.id;

  insert into public.app_settings(organization_id, id, company_name)
  values (org_id, 1, left(display_name, 160))
  on conflict (organization_id, id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Existing Auth users that are still outside an organization get one.
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
    where not exists (
      select 1 from public.organization_members om where om.user_id = p.id and om.is_active
    )
  loop
    base_slug := regexp_replace(lower(coalesce(split_part(u.email, '@', 1), 'ilya')), '[^a-z0-9]+', '-', 'g');
    base_slug := trim(both '-' from base_slug);
    if base_slug = '' then base_slug := 'ilya'; end if;

    insert into public.organizations(name, slug, owner_id)
    values (left(coalesce(u.full_name, 'متجري ILYA'), 160),
            left(base_slug, 40) || '-' || substr(replace(u.id::text,'-',''),1,10),
            u.id)
    returning id into org_id;

    insert into public.organization_members(organization_id, user_id, role, is_active)
    values (org_id, u.id, 'owner', true);

    update public.profiles set active_organization_id = org_id, role = 'owner' where id = u.id;

    insert into public.app_settings(organization_id, id, company_name)
    values (org_id, 1, left(coalesce(u.full_name, 'ILYA'), 160))
    on conflict (organization_id, id) do nothing;
  end loop;
end $$;

-- Ensure every new organization gets a settings row.
create or replace function public.current_organization_id()
returns uuid
language sql stable security definer
set search_path = public, pg_temp
as $$
  select p.active_organization_id
  from public.profiles p
  where p.id = auth.uid()
    and p.is_active
    and exists (
      select 1 from public.organization_members om
      where om.organization_id = p.active_organization_id
        and om.user_id = auth.uid()
        and om.is_active
    )
  limit 1;
$$;

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select target_org is not null
     and exists (
       select 1 from public.organization_members om
       where om.organization_id = target_org
         and om.user_id = auth.uid()
         and om.is_active
     );
$$;

create or replace function public.my_role()
returns public.user_role
language sql stable security definer
set search_path = public, pg_temp
as $$
  select om.role
  from public.organization_members om
  where om.organization_id = public.current_organization_id()
    and om.user_id = auth.uid()
    and om.is_active
  limit 1;
$$;

create or replace function public.is_active_user()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.current_organization_id() is not null;
$$;

-- A brand-new database may have the default settings row but no Auth user yet.
-- Remove that unattached seed row; the first registered workspace gets its own settings row.
delete from public.app_settings
where organization_id is null
  and not exists (select 1 from public.organizations);

-- Refuse to continue if any legacy row could not be assigned to a tenant.
do $$
declare
  t text;
  n bigint;
begin
  foreach t in array array[
    'app_settings','customers','suppliers','product_categories','products',
    'stock_movements','sales_invoices','sales_invoice_items',
    'purchase_invoices','purchase_invoice_items','sales_returns','sales_return_items',
    'purchase_returns','purchase_return_items','debt_payments',
    'expense_categories','expenses','audit_log','notifications','backup_log'
  ] loop
    execute format('select count(*) from public.%I where organization_id is null', t) into n;
    if n > 0 then
      raise exception 'Tenant migration incomplete: %.organization_id has % null rows', t, n;
    end if;
  end loop;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'app_settings','customers','suppliers','product_categories','products',
    'stock_movements','sales_invoices','sales_invoice_items',
    'purchase_invoices','purchase_invoice_items','sales_returns','sales_return_items',
    'purchase_returns','purchase_return_items','debt_payments',
    'expense_categories','expenses','audit_log','notifications','backup_log'
  ] loop
    execute format('alter table public.%I alter column organization_id set not null', t);
    execute format('alter table public.%I drop constraint if exists %I_organization_id_fkey', t, t);
    execute format(
      'alter table public.%I add constraint %I_organization_id_fkey foreign key (organization_id) references public.organizations(id) on delete cascade',
      t, t
    );
  end loop;
end $$;

-- Tenant-safe debt views. security_invoker ensures underlying-table RLS is respected.
create or replace view public.customer_balances
with (security_invoker = true)
as
select
  c.id as customer_id,
  c.name,
  c.opening_balance_iqd
    + coalesce((select sum(si.total_iqd) from public.sales_invoices si where si.organization_id = c.organization_id and si.customer_id = c.id and si.status = 'confirmed'), 0)
    - coalesce((select sum(si.paid_iqd) from public.sales_invoices si where si.organization_id = c.organization_id and si.customer_id = c.id and si.status = 'confirmed'), 0)
    - coalesce((select sum(dp.amount_iqd) from public.debt_payments dp where dp.organization_id = c.organization_id and dp.customer_id = c.id and dp.direction = 'from_customer'), 0)
    - coalesce((select sum(sr.total_iqd) from public.sales_returns sr where sr.organization_id = c.organization_id and sr.customer_id = c.id), 0)
    as balance_iqd
from public.customers c
where c.organization_id = public.current_organization_id();

create or replace view public.supplier_balances
with (security_invoker = true)
as
select
  s.id as supplier_id,
  s.name,
  s.opening_balance_iqd
    + coalesce((select sum(pi.total_iqd) from public.purchase_invoices pi where pi.organization_id = s.organization_id and pi.supplier_id = s.id and pi.status = 'confirmed'), 0)
    - coalesce((select sum(pi.paid_iqd) from public.purchase_invoices pi where pi.organization_id = s.organization_id and pi.supplier_id = s.id and pi.status = 'confirmed'), 0)
    - coalesce((select sum(dp.amount_iqd) from public.debt_payments dp where dp.organization_id = s.organization_id and dp.supplier_id = s.id and dp.direction = 'to_supplier'), 0)
    - coalesce((select sum(pr.total_iqd) from public.purchase_returns pr where pr.organization_id = s.organization_id and pr.supplier_id = s.id), 0)
    as balance_iqd
from public.suppliers s
where s.organization_id = public.current_organization_id();

-- Tenant-first indexes keep RLS-filtered list/report queries fast.
do $$
declare
  t text;
begin
  foreach t in array array[
    'app_settings','customers','suppliers','product_categories','products',
    'stock_movements','sales_invoices','sales_invoice_items',
    'purchase_invoices','purchase_invoice_items','sales_returns','sales_return_items',
    'purchase_returns','purchase_return_items','debt_payments',
    'expense_categories','expenses','audit_log','notifications','backup_log'
  ] loop
    execute format('create index if not exists idx_%I_org on public.%I(organization_id)', t, t);
  end loop;
end $$;

-- Normalize legacy unique constraints to tenant-scoped uniqueness.
alter table public.app_settings drop constraint if exists app_settings_pkey;
alter table public.app_settings drop constraint if exists single_row;
alter table public.app_settings add constraint app_settings_pkey primary key (organization_id, id);

-- These legacy *_key objects may be UNIQUE constraints rather than standalone
-- indexes. Drop the owning constraints first; otherwise PostgreSQL refuses to
-- drop the backing index (SQLSTATE 2BP01).
alter table public.products drop constraint if exists products_sku_key;
alter table public.products drop constraint if exists products_barcode_key;
alter table public.product_categories drop constraint if exists product_categories_name_key;
alter table public.sales_invoices drop constraint if exists sales_invoices_invoice_number_key;
alter table public.purchase_invoices drop constraint if exists purchase_invoices_invoice_number_key;
alter table public.sales_returns drop constraint if exists sales_returns_return_number_key;
alter table public.purchase_returns drop constraint if exists purchase_returns_return_number_key;

drop index if exists public.products_sku_key;
drop index if exists public.products_barcode_key;
drop index if exists public.product_categories_name_key;
drop index if exists public.sales_invoices_invoice_number_key;
drop index if exists public.purchase_invoices_invoice_number_key;
drop index if exists public.sales_returns_return_number_key;
drop index if exists public.purchase_returns_return_number_key;
drop index if exists public.idx_sales_invoices_client_local_id;
drop index if exists public.idx_purchase_invoices_client_local_id;

create unique index if not exists uq_categories_org_name on public.product_categories(organization_id, name);
create unique index if not exists uq_products_org_sku on public.products(organization_id, sku) where sku is not null;
create unique index if not exists uq_products_org_barcode on public.products(organization_id, barcode) where barcode is not null;
create unique index if not exists uq_sales_org_invoice_number on public.sales_invoices(organization_id, invoice_number);
create unique index if not exists uq_purchase_org_invoice_number on public.purchase_invoices(organization_id, invoice_number);
create unique index if not exists uq_sales_returns_org_number on public.sales_returns(organization_id, return_number);
create unique index if not exists uq_purchase_returns_org_number on public.purchase_returns(organization_id, return_number);
create unique index if not exists uq_sales_org_client_local on public.sales_invoices(organization_id, client_local_id) where client_local_id is not null;
create unique index if not exists uq_purchase_org_client_local on public.purchase_invoices(organization_id, client_local_id) where client_local_id is not null;

-- Backstop trigger: clients can never choose another tenant.
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
    -- provisioning run by the Supabase Auth trigger, or this migration's own
    -- setup scripts) -- never by a real client request: every tenant table's
    -- own row-level-security policy independently requires
    -- is_org_member(organization_id), which itself requires auth.uid() to
    -- match a real active membership row, so an anonymous or logged-out
    -- request can never pass that check regardless of what happens here.
    -- We therefore trust the organization_id such trusted code already set.

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

do $$
declare
  t text;
begin
  foreach t in array array[
    'app_settings','customers','suppliers','product_categories','products',
    'stock_movements','sales_invoices','sales_invoice_items',
    'purchase_invoices','purchase_invoice_items','sales_returns','sales_return_items',
    'purchase_returns','purchase_return_items','debt_payments',
    'expense_categories','expenses','audit_log','notifications','backup_log'
  ] loop
    execute format('drop trigger if exists trg_force_current_org on public.%I', t);
    execute format('create trigger trg_force_current_org before insert or update on public.%I for each row execute function public.force_current_org()', t);
  end loop;
end $$;

-- RLS: remove legacy single-workspace policies, then replace them.
do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'profiles','organizations','organization_members','organization_invitations',
    'app_settings','customers','suppliers','product_categories','products',
    'stock_movements','sales_invoices','sales_invoice_items',
    'purchase_invoices','purchase_invoice_items','sales_returns','sales_return_items',
    'purchase_returns','purchase_return_items','debt_payments',
    'expense_categories','expenses','audit_log','notifications','backup_log'
  ] loop
    for p in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;
  end loop;
end $$;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invitations enable row level security;

-- Profiles: visible to members of the active organization; users can edit own safe fields.
create policy profiles_select_org on public.profiles
for select using (
  id = auth.uid()
  or exists (
    select 1 from public.organization_members om
    where om.organization_id = public.current_organization_id()
      and om.user_id = profiles.id
      and om.is_active
  )
);
create policy profiles_update_self on public.profiles
for update using (id = auth.uid())
with check (id = auth.uid());

-- Organization discovery is membership-scoped.
create policy organizations_select_member on public.organizations
for select using (public.is_org_member(id));

create policy organizations_update_owner_admin on public.organizations
for update using (
  public.is_org_member(id) and public.my_role() in ('owner','admin')
)
with check (public.is_org_member(id));

create policy members_select_org on public.organization_members
for select using (
  user_id = auth.uid()
  or public.is_org_member(organization_id)
);

create policy members_insert_owner_admin on public.organization_members
for insert with check (
  public.is_org_member(organization_id) and public.my_role() in ('owner','admin')
);
create policy members_update_owner_admin on public.organization_members
for update using (
  public.is_org_member(organization_id) and public.my_role() in ('owner','admin')
)
with check (
  public.is_org_member(organization_id) and public.my_role() in ('owner','admin')
);
create policy members_delete_owner_admin on public.organization_members
for delete using (
  public.is_org_member(organization_id) and public.my_role() in ('owner','admin')
);

create policy invitations_select_admin on public.organization_invitations
for select using (public.is_org_member(organization_id) and public.my_role() in ('owner','admin'));
create policy invitations_insert_admin on public.organization_invitations
for insert with check (public.is_org_member(organization_id) and public.my_role() in ('owner','admin'));
create policy invitations_update_admin on public.organization_invitations
for update using (public.is_org_member(organization_id) and public.my_role() in ('owner','admin'));
create policy invitations_delete_admin on public.organization_invitations
for delete using (public.is_org_member(organization_id) and public.my_role() in ('owner','admin'));

-- Tenant table policies. Membership is checked by organization_id on every request.
create policy settings_select_org on public.app_settings for select using (public.is_org_member(organization_id));
create policy settings_update_admin on public.app_settings for update using (public.is_org_member(organization_id) and public.my_role() in ('owner','admin'))
with check (public.is_org_member(organization_id));

create policy customers_read_org on public.customers for select using (public.is_org_member(organization_id));
create policy customers_insert on public.customers for insert with check (public.is_org_member(organization_id) and public.my_role() in ('owner','admin','accountant','cashier'));
create policy customers_update on public.customers for update using (public.is_org_member(organization_id) and public.my_role() in ('owner','admin','accountant'));
create policy customers_delete on public.customers for delete using (public.is_org_member(organization_id) and public.my_role() in ('owner','admin'));

create policy suppliers_read_org on public.suppliers for select using (public.is_org_member(organization_id));
create policy suppliers_insert on public.suppliers for insert with check (public.is_org_member(organization_id) and public.my_role() in ('owner','admin','accountant'));
create policy suppliers_update on public.suppliers for update using (public.is_org_member(organization_id) and public.my_role() in ('owner','admin','accountant'));
create policy suppliers_delete on public.suppliers for delete using (public.is_org_member(organization_id) and public.my_role() in ('owner','admin'));

create policy categories_read_org on public.product_categories for select using (public.is_org_member(organization_id));
create policy categories_write on public.product_categories for all using (public.is_org_member(organization_id) and public.my_role() in ('owner','admin','accountant'))
with check (public.is_org_member(organization_id) and public.my_role() in ('owner','admin','accountant'));

create policy products_read_org on public.products for select using (public.is_org_member(organization_id));
create policy products_insert on public.products for insert with check (public.is_org_member(organization_id) and public.my_role() in ('owner','admin','accountant'));
create policy products_update on public.products for update using (public.is_org_member(organization_id) and public.my_role() in ('owner','admin','accountant'));
create policy products_delete on public.products for delete using (public.is_org_member(organization_id) and public.my_role() in ('owner','admin'));

create policy stock_read_org on public.stock_movements for select using (public.is_org_member(organization_id));

create policy sales_read_org on public.sales_invoices for select using (public.is_org_member(organization_id));
create policy sales_insert on public.sales_invoices for insert with check (public.is_org_member(organization_id) and public.my_role() in ('owner','admin','accountant','cashier'));
create policy sales_update on public.sales_invoices for update using (public.is_org_member(organization_id) and public.my_role() in ('owner','admin','accountant'));
create policy sales_delete on public.sales_invoices for delete using (public.is_org_member(organization_id) and public.my_role() in ('owner','admin'));

create policy sales_items_read on public.sales_invoice_items for select using (public.is_org_member(organization_id));
create policy sales_items_insert on public.sales_invoice_items for insert with check (public.is_org_member(organization_id) and public.my_role() in ('owner','admin','accountant','cashier'));

create policy purchases_read_org on public.purchase_invoices for select using (public.is_org_member(organization_id));
create policy purchases_insert on public.purchase_invoices for insert with check (public.is_org_member(organization_id) and public.my_role() in ('owner','admin','accountant'));
create policy purchases_update on public.purchase_invoices for update using (public.is_org_member(organization_id) and public.my_role() in ('owner','admin','accountant'));
create policy purchases_delete on public.purchase_invoices for delete using (public.is_org_member(organization_id) and public.my_role() in ('owner','admin'));

create policy purchase_items_read on public.purchase_invoice_items for select using (public.is_org_member(organization_id));
create policy purchase_items_insert on public.purchase_invoice_items for insert with check (public.is_org_member(organization_id) and public.my_role() in ('owner','admin','accountant'));

create policy sales_returns_read on public.sales_returns for select using (public.is_org_member(organization_id));
create policy sales_returns_insert on public.sales_returns for insert with check (public.is_org_member(organization_id) and public.my_role() in ('owner','admin','accountant','cashier'));
create policy sales_return_items_read on public.sales_return_items for select using (public.is_org_member(organization_id));
create policy sales_return_items_insert on public.sales_return_items for insert with check (public.is_org_member(organization_id) and public.my_role() in ('owner','admin','accountant','cashier'));

create policy purchase_returns_read on public.purchase_returns for select using (public.is_org_member(organization_id));
create policy purchase_returns_insert on public.purchase_returns for insert with check (public.is_org_member(organization_id) and public.my_role() in ('owner','admin','accountant'));
create policy purchase_return_items_read on public.purchase_return_items for select using (public.is_org_member(organization_id));
create policy purchase_return_items_insert on public.purchase_return_items for insert with check (public.is_org_member(organization_id) and public.my_role() in ('owner','admin','accountant'));

create policy debt_read_org on public.debt_payments for select using (public.is_org_member(organization_id));
create policy debt_insert on public.debt_payments for insert with check (public.is_org_member(organization_id) and public.my_role() in ('owner','admin','accountant','cashier'));

create policy expense_categories_read on public.expense_categories for select using (public.is_org_member(organization_id));
create policy expense_categories_write on public.expense_categories for all using (public.is_org_member(organization_id) and public.my_role() in ('owner','admin','accountant'))
with check (public.is_org_member(organization_id) and public.my_role() in ('owner','admin','accountant'));

create policy expenses_read_org on public.expenses for select using (public.is_org_member(organization_id));
create policy expenses_insert on public.expenses for insert with check (public.is_org_member(organization_id) and public.my_role() in ('owner','admin','accountant'));

create policy audit_read_admin on public.audit_log for select using (public.is_org_member(organization_id) and public.my_role() in ('owner','admin'));
-- No direct INSERT policy: audit rows are generated by SECURITY DEFINER triggers only.

create policy notifications_own on public.notifications for all using (
  public.is_org_member(organization_id) and user_id = auth.uid()
) with check (
  public.is_org_member(organization_id) and user_id = auth.uid()
);

create policy backup_read_admin on public.backup_log for select using (public.is_org_member(organization_id) and public.my_role() in ('owner','admin'));
create policy backup_insert on public.backup_log for insert with check (public.is_org_member(organization_id));

-- updated_at triggers
drop trigger if exists trg_organizations_updated on public.organizations;
create trigger trg_organizations_updated before update on public.organizations for each row execute function public.set_updated_at();

drop trigger if exists trg_org_members_updated on public.organization_members;
create trigger trg_org_members_updated before update on public.organization_members for each row execute function public.set_updated_at();

-- Organization ownership is immutable through the generic update endpoint.
-- A future ownership-transfer flow can use a dedicated audited RPC.
create or replace function public.guard_organization_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.owner_id is distinct from old.owner_id then
    raise exception 'Organization owner cannot be changed directly';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_guard_organization_update on public.organizations;
create trigger trg_guard_organization_update
before update on public.organizations
for each row execute function public.guard_organization_update();

-- Prevent changing another user's active organization through profile update.
create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() = old.id then
    if new.id <> old.id or new.role <> old.role then
      new.role := old.role;
    end if;
    if new.active_organization_id is distinct from old.active_organization_id then
      if not public.is_org_member(new.active_organization_id) then
        raise exception 'Not a member of selected organization';
      end if;
      select om.role into new.role
      from public.organization_members om
      where om.organization_id = new.active_organization_id
        and om.user_id = auth.uid()
        and om.is_active;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_guard_profile_update on public.profiles;
create trigger trg_guard_profile_update before update on public.profiles for each row execute function public.guard_profile_update();

-- Keep every organization recoverable: do not remove/deactivate its last owner.
create or replace function public.guard_membership_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  owner_count integer;
begin
  if tg_op in ('INSERT','UPDATE')
     and new.role = 'owner'
     and public.my_role() <> 'owner'
     and not exists (
       select 1 from public.organizations o
       where o.id = new.organization_id and o.owner_id = auth.uid()
     ) then
    raise exception 'Only an owner can assign the owner role';
  end if;

  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and (not new.is_active or new.role <> 'owner')) then
    select count(*) into owner_count
    from public.organization_members
    where organization_id = old.organization_id
      and role = 'owner'
      and is_active
      and user_id <> old.user_id;

    if owner_count = 0 then
      raise exception 'Organization must keep at least one active owner';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_guard_membership_change on public.organization_members;
create trigger trg_guard_membership_change
before update or delete on public.organization_members
for each row execute function public.guard_membership_change();

-- Secure RPC for switching workspaces.
create or replace function public.switch_organization(target_org uuid)
returns public.profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result public.profiles;
begin
  if not public.is_org_member(target_org) then
    raise exception 'You are not a member of this organization';
  end if;

  update public.profiles p
    set active_organization_id = target_org,
        role = (
          select om.role from public.organization_members om
          where om.organization_id = target_org and om.user_id = auth.uid() and om.is_active
        )
  where p.id = auth.uid()
  returning p.* into result;

  return result;
end;
$$;

revoke all on function public.switch_organization(uuid) from public;
grant execute on function public.switch_organization(uuid) to authenticated;

-- Organization creation for authenticated users (for future "new store" feature).
create or replace function public.create_organization(org_name text)
returns public.organizations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_org public.organizations;
  slug_base text;
begin
  if auth.uid() is null or length(trim(org_name)) < 2 then
    raise exception 'Organization name is required';
  end if;

  slug_base := regexp_replace(lower(trim(org_name)), '[^a-z0-9\u0600-\u06ff]+', '-', 'g');
  slug_base := trim(both '-' from slug_base);
  if slug_base = '' then slug_base := 'org'; end if;
  slug_base := left(slug_base, 40) || '-' || substr(replace(auth.uid()::text,'-',''),1,10);

  insert into public.organizations(name, slug, owner_id)
  values (left(trim(org_name), 160), slug_base, auth.uid())
  returning * into new_org;

  insert into public.organization_members(organization_id, user_id, role, is_active)
  values (new_org.id, auth.uid(), 'owner', true);

  update public.profiles
    set active_organization_id = new_org.id, role = 'owner'
  where id = auth.uid();

  insert into public.app_settings(organization_id, id, company_name)
  values (new_org.id, 1, new_org.name);

  return new_org;
end;
$$;

revoke all on function public.create_organization(text) from public;
grant execute on function public.create_organization(text) to authenticated;

-- Accept an invitation without exposing token hashes or requiring a service key.
create or replace function public.accept_organization_invitation(invite_token text)
returns public.organization_members
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inv public.organization_invitations;
  member public.organization_members;
  token_digest text;
begin
  if auth.uid() is null or length(trim(invite_token)) < 16 then
    raise exception 'Invalid invitation';
  end if;

  token_digest := encode(digest(invite_token, 'sha256'), 'hex');

  select * into inv
  from public.organization_invitations
  where token_hash = token_digest
    and accepted_at is null
    and expires_at > now()
  for update;

  if inv.id is null then
    raise exception 'Invitation is invalid or expired';
  end if;

  if lower(inv.email) <> lower(coalesce((select email from auth.users where id = auth.uid()), '')) then
    raise exception 'Invitation email does not match the signed-in account';
  end if;

  insert into public.organization_members(organization_id, user_id, role, is_active)
  values (inv.organization_id, auth.uid(), inv.role, true)
  on conflict (organization_id, user_id) do update
    set role = excluded.role, is_active = true
  returning * into member;

  update public.organization_invitations
    set accepted_at = now()
  where id = inv.id;

  update public.profiles
    set active_organization_id = inv.organization_id,
        role = member.role
  where id = auth.uid();

  return member;
end;
$$;
revoke all on function public.accept_organization_invitation(text) from public;
grant execute on function public.accept_organization_invitation(text) to authenticated;

commit;
