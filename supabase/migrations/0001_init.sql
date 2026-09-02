-- ============================================================================
-- ILYA Accounting — نظام محاسبي متكامل بالدينار العراقي
-- Initial schema — run this once in Supabase SQL editor (or via CLI migrations)
-- All monetary amounts are stored as BIGINT in IQD fils-free (whole dinars)
-- to avoid floating point errors. amount_iqd = 5000 means 5,000 IQD.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. ROLES & PROFILES
-- ----------------------------------------------------------------------------
create type user_role as enum ('owner', 'admin', 'accountant', 'cashier', 'viewer');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null default 'viewer',
  is_active boolean not null default true,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Devices allowed to use this account (per Jalal's request: track 1-3 personal devices)
create table devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  device_name text not null,
  device_fingerprint text not null,
  last_seen_at timestamptz not null default now(),
  is_trusted boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, device_fingerprint)
);

-- ----------------------------------------------------------------------------
-- 2. COMPANY SETTINGS
-- ----------------------------------------------------------------------------
create table app_settings (
  id int primary key default 1,
  company_name text not null default 'ILYA',
  company_phone text,
  company_address text,
  logo_url text,
  currency_code text not null default 'IQD',
  invoice_prefix_sales text not null default 'INV',
  invoice_prefix_purchase text not null default 'PUR',
  low_stock_threshold int not null default 5,
  backup_email text,
  auto_backup_enabled boolean not null default true,
  auto_backup_frequency_days int not null default 7,
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);
insert into app_settings (id) values (1) on conflict do nothing;

-- ----------------------------------------------------------------------------
-- 3. PARTIES: customers & suppliers
-- ----------------------------------------------------------------------------
create table customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  notes text,
  opening_balance_iqd bigint not null default 0, -- positive = customer owes us
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_customers_name on customers using gin (to_tsvector('simple', name));

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  notes text,
  opening_balance_iqd bigint not null default 0, -- positive = we owe supplier
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_suppliers_name on suppliers using gin (to_tsvector('simple', name));

-- ----------------------------------------------------------------------------
-- 4. PRODUCTS & INVENTORY
-- ----------------------------------------------------------------------------
create table product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  sku text unique,
  barcode text unique,
  name text not null,
  category_id uuid references product_categories(id) on delete set null,
  unit text not null default 'قطعة', -- e.g. قطعة، كيلو، متر
  cost_price_iqd bigint not null default 0,
  sale_price_iqd bigint not null default 0,
  quantity_on_hand numeric not null default 0,
  reorder_point numeric not null default 5,
  is_active boolean not null default true,
  image_url text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_products_name on products using gin (to_tsvector('simple', name));

-- Immutable ledger of every stock movement (sale, purchase, return, adjustment)
create type stock_movement_type as enum (
  'purchase', 'sale', 'purchase_return', 'sale_return', 'adjustment'
);

create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id),
  movement_type stock_movement_type not null,
  quantity_delta numeric not null, -- positive = stock in, negative = stock out
  reference_table text, -- e.g. 'sales_invoices'
  reference_id uuid,
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index idx_stock_movements_product on stock_movements(product_id, created_at desc);

-- ----------------------------------------------------------------------------
-- 5. SALES (بيع نقدي / بيع بالدين — آجل)
-- ----------------------------------------------------------------------------
create type invoice_status as enum ('draft', 'confirmed', 'cancelled');
create type payment_method as enum ('cash', 'credit', 'partial');

create table sales_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  customer_id uuid references customers(id),
  status invoice_status not null default 'confirmed',
  payment_method payment_method not null default 'cash',
  subtotal_iqd bigint not null default 0,
  discount_iqd bigint not null default 0,
  total_iqd bigint not null default 0,
  paid_iqd bigint not null default 0, -- amount actually paid at time of sale
  due_iqd bigint generated always as (total_iqd - paid_iqd) stored,
  notes text,
  client_local_id text, -- for offline draft de-duplication / idempotency
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_sales_invoices_customer on sales_invoices(customer_id);
create index idx_sales_invoices_created on sales_invoices(created_at desc);
create unique index idx_sales_invoices_client_local_id on sales_invoices(client_local_id) where client_local_id is not null;

create table sales_invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references sales_invoices(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity numeric not null,
  unit_price_iqd bigint not null,
  line_total_iqd bigint generated always as (quantity * unit_price_iqd) stored
);
create index idx_sales_items_invoice on sales_invoice_items(invoice_id);

-- ----------------------------------------------------------------------------
-- 6. PURCHASES (شراء من المورد)
-- ----------------------------------------------------------------------------
create table purchase_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  supplier_id uuid references suppliers(id),
  status invoice_status not null default 'confirmed',
  payment_method payment_method not null default 'cash',
  subtotal_iqd bigint not null default 0,
  discount_iqd bigint not null default 0,
  total_iqd bigint not null default 0,
  paid_iqd bigint not null default 0,
  due_iqd bigint generated always as (total_iqd - paid_iqd) stored,
  notes text,
  client_local_id text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_purchase_invoices_supplier on purchase_invoices(supplier_id);
create unique index idx_purchase_invoices_client_local_id on purchase_invoices(client_local_id) where client_local_id is not null;

create table purchase_invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references purchase_invoices(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity numeric not null,
  unit_cost_iqd bigint not null,
  line_total_iqd bigint generated always as (quantity * unit_cost_iqd) stored
);
create index idx_purchase_items_invoice on purchase_invoice_items(invoice_id);

-- ----------------------------------------------------------------------------
-- 7. RETURNS (مرتجع بيع / مرتجع شراء)
-- ----------------------------------------------------------------------------
create table sales_returns (
  id uuid primary key default gen_random_uuid(),
  return_number text not null unique,
  original_invoice_id uuid references sales_invoices(id),
  customer_id uuid references customers(id),
  total_iqd bigint not null default 0,
  reason text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table sales_return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references sales_returns(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity numeric not null,
  unit_price_iqd bigint not null,
  line_total_iqd bigint generated always as (quantity * unit_price_iqd) stored
);

create table purchase_returns (
  id uuid primary key default gen_random_uuid(),
  return_number text not null unique,
  original_invoice_id uuid references purchase_invoices(id),
  supplier_id uuid references suppliers(id),
  total_iqd bigint not null default 0,
  reason text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table purchase_return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references purchase_returns(id) on delete cascade,
  product_id uuid not null references products(id),
  quantity numeric not null,
  unit_cost_iqd bigint not null,
  line_total_iqd bigint generated always as (quantity * unit_cost_iqd) stored
);

-- ----------------------------------------------------------------------------
-- 8. PAYMENTS — تسديد الديون (customer pays us / we pay supplier)
-- ----------------------------------------------------------------------------
create type payment_direction as enum ('from_customer', 'to_supplier');

create table debt_payments (
  id uuid primary key default gen_random_uuid(),
  direction payment_direction not null,
  customer_id uuid references customers(id),
  supplier_id uuid references suppliers(id),
  amount_iqd bigint not null check (amount_iqd > 0),
  method text not null default 'cash', -- cash / transfer / other
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  constraint one_party check (
    (direction = 'from_customer' and customer_id is not null and supplier_id is null) or
    (direction = 'to_supplier' and supplier_id is not null and customer_id is null)
  )
);
create index idx_debt_payments_customer on debt_payments(customer_id);
create index idx_debt_payments_supplier on debt_payments(supplier_id);

-- ----------------------------------------------------------------------------
-- 9. CASH & EXPENSES
-- ----------------------------------------------------------------------------
create table expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references expense_categories(id),
  amount_iqd bigint not null check (amount_iqd > 0),
  description text,
  spent_at date not null default current_date,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index idx_expenses_spent_at on expenses(spent_at desc);

-- ----------------------------------------------------------------------------
-- 10. AUDIT LOG & NOTIFICATIONS
-- ----------------------------------------------------------------------------
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  action text not null, -- e.g. 'create', 'update', 'delete', 'login'
  entity_table text not null,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);
create index idx_audit_log_created on audit_log(created_at desc);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  title text not null,
  body text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_notifications_user on notifications(user_id, is_read);

create table backup_log (
  id uuid primary key default gen_random_uuid(),
  triggered_by uuid references profiles(id),
  sent_to_email text,
  status text not null default 'success', -- success / failed
  file_size_bytes bigint,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- TRIGGERS: keep updated_at fresh
-- ============================================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated before update on profiles for each row execute function set_updated_at();
create trigger trg_customers_updated before update on customers for each row execute function set_updated_at();
create trigger trg_suppliers_updated before update on suppliers for each row execute function set_updated_at();
create trigger trg_products_updated before update on products for each row execute function set_updated_at();
create trigger trg_sales_invoices_updated before update on sales_invoices for each row execute function set_updated_at();
create trigger trg_purchase_invoices_updated before update on purchase_invoices for each row execute function set_updated_at();

-- ============================================================================
-- TRIGGERS: auto-adjust stock + write stock_movements on invoice items
-- ============================================================================
create or replace function apply_sale_item_stock()
returns trigger language plpgsql as $$
begin
  update products set quantity_on_hand = quantity_on_hand - new.quantity where id = new.product_id;
  insert into stock_movements(product_id, movement_type, quantity_delta, reference_table, reference_id)
  values (new.product_id, 'sale', -new.quantity, 'sales_invoices', new.invoice_id);
  return new;
end;
$$;
create trigger trg_sales_item_stock after insert on sales_invoice_items for each row execute function apply_sale_item_stock();

create or replace function apply_purchase_item_stock()
returns trigger language plpgsql as $$
begin
  update products set quantity_on_hand = quantity_on_hand + new.quantity where id = new.product_id;
  insert into stock_movements(product_id, movement_type, quantity_delta, reference_table, reference_id)
  values (new.product_id, 'purchase', new.quantity, 'purchase_invoices', new.invoice_id);
  return new;
end;
$$;
create trigger trg_purchase_item_stock after insert on purchase_invoice_items for each row execute function apply_purchase_item_stock();

create or replace function apply_sale_return_stock()
returns trigger language plpgsql as $$
begin
  update products set quantity_on_hand = quantity_on_hand + new.quantity where id = new.product_id;
  insert into stock_movements(product_id, movement_type, quantity_delta, reference_table, reference_id)
  values (new.product_id, 'sale_return', new.quantity, 'sales_returns', new.return_id);
  return new;
end;
$$;
create trigger trg_sale_return_stock after insert on sales_return_items for each row execute function apply_sale_return_stock();

create or replace function apply_purchase_return_stock()
returns trigger language plpgsql as $$
begin
  update products set quantity_on_hand = quantity_on_hand - new.quantity where id = new.product_id;
  insert into stock_movements(product_id, movement_type, quantity_delta, reference_table, reference_id)
  values (new.product_id, 'purchase_return', -new.quantity, 'purchase_returns', new.return_id);
  return new;
end;
$$;
create trigger trg_purchase_return_stock after insert on purchase_return_items for each row execute function apply_purchase_return_stock();

-- ============================================================================
-- VIEWS: computed balances (debts) — this is the "دين" ledger
-- ============================================================================
create or replace view customer_balances as
select
  c.id as customer_id,
  c.name,
  c.opening_balance_iqd
    + coalesce((select sum(si.total_iqd) from sales_invoices si where si.customer_id = c.id and si.status = 'confirmed'), 0)
    - coalesce((select sum(si.paid_iqd) from sales_invoices si where si.customer_id = c.id and si.status = 'confirmed'), 0)
    - coalesce((select sum(dp.amount_iqd) from debt_payments dp where dp.customer_id = c.id and dp.direction = 'from_customer'), 0)
    + coalesce((select sum(sr.total_iqd) from sales_returns sr where sr.customer_id = c.id), 0) * -1
    as balance_iqd
from customers c;

create or replace view supplier_balances as
select
  s.id as supplier_id,
  s.name,
  s.opening_balance_iqd
    + coalesce((select sum(pi.total_iqd) from purchase_invoices pi where pi.supplier_id = s.id and pi.status = 'confirmed'), 0)
    - coalesce((select sum(pi.paid_iqd) from purchase_invoices pi where pi.supplier_id = s.id and pi.status = 'confirmed'), 0)
    - coalesce((select sum(dp.amount_iqd) from debt_payments dp where dp.supplier_id = s.id and dp.direction = 'to_supplier'), 0)
    + coalesce((select sum(pr.total_iqd) from purchase_returns pr where pr.supplier_id = s.id), 0) * -1
    as balance_iqd
from suppliers s;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
create or replace function my_role() returns user_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_active from profiles where id = auth.uid()), false);
$$;

alter table profiles enable row level security;
alter table devices enable row level security;
alter table app_settings enable row level security;
alter table customers enable row level security;
alter table suppliers enable row level security;
alter table product_categories enable row level security;
alter table products enable row level security;
alter table stock_movements enable row level security;
alter table sales_invoices enable row level security;
alter table sales_invoice_items enable row level security;
alter table purchase_invoices enable row level security;
alter table purchase_invoice_items enable row level security;
alter table sales_returns enable row level security;
alter table sales_return_items enable row level security;
alter table purchase_returns enable row level security;
alter table purchase_return_items enable row level security;
alter table debt_payments enable row level security;
alter table expense_categories enable row level security;
alter table expenses enable row level security;
alter table audit_log enable row level security;
alter table notifications enable row level security;
alter table backup_log enable row level security;

-- profiles: everyone active can see all profiles (small team); only owner/admin edit
create policy profiles_select on profiles for select using (is_active_user());
create policy profiles_update_self on profiles for update using (id = auth.uid());
create policy profiles_admin_all on profiles for all using (my_role() in ('owner','admin'));

create policy devices_own on devices for all using (user_id = auth.uid() or my_role() in ('owner','admin'));

create policy settings_select on app_settings for select using (is_active_user());
create policy settings_admin_write on app_settings for update using (my_role() in ('owner','admin'));

-- viewer role = read-only across business data; cashier can insert sales/payments;
-- accountant can do everything except manage users; owner/admin = full control
create policy customers_read on customers for select using (is_active_user());
create policy customers_write on customers for insert with check (my_role() in ('owner','admin','accountant','cashier'));
create policy customers_update on customers for update using (my_role() in ('owner','admin','accountant'));
create policy customers_delete on customers for delete using (my_role() in ('owner','admin'));

create policy suppliers_read on suppliers for select using (is_active_user());
create policy suppliers_write on suppliers for insert with check (my_role() in ('owner','admin','accountant'));
create policy suppliers_update on suppliers for update using (my_role() in ('owner','admin','accountant'));
create policy suppliers_delete on suppliers for delete using (my_role() in ('owner','admin'));

create policy categories_read on product_categories for select using (is_active_user());
create policy categories_write on product_categories for all using (my_role() in ('owner','admin','accountant'));

create policy products_read on products for select using (is_active_user());
create policy products_write on products for insert with check (my_role() in ('owner','admin','accountant'));
create policy products_update on products for update using (my_role() in ('owner','admin','accountant'));
create policy products_delete on products for delete using (my_role() in ('owner','admin'));

create policy stock_movements_read on stock_movements for select using (is_active_user());
create policy stock_movements_write on stock_movements for insert with check (is_active_user());

create policy sales_invoices_read on sales_invoices for select using (is_active_user());
create policy sales_invoices_write on sales_invoices for insert with check (my_role() in ('owner','admin','accountant','cashier'));
create policy sales_invoices_update on sales_invoices for update using (my_role() in ('owner','admin','accountant'));
create policy sales_invoices_delete on sales_invoices for delete using (my_role() in ('owner','admin'));

create policy sales_items_read on sales_invoice_items for select using (is_active_user());
create policy sales_items_write on sales_invoice_items for insert with check (my_role() in ('owner','admin','accountant','cashier'));

create policy purchase_invoices_read on purchase_invoices for select using (is_active_user());
create policy purchase_invoices_write on purchase_invoices for insert with check (my_role() in ('owner','admin','accountant'));
create policy purchase_invoices_update on purchase_invoices for update using (my_role() in ('owner','admin','accountant'));
create policy purchase_invoices_delete on purchase_invoices for delete using (my_role() in ('owner','admin'));

create policy purchase_items_read on purchase_invoice_items for select using (is_active_user());
create policy purchase_items_write on purchase_invoice_items for insert with check (my_role() in ('owner','admin','accountant'));

create policy sales_returns_read on sales_returns for select using (is_active_user());
create policy sales_returns_write on sales_returns for insert with check (my_role() in ('owner','admin','accountant','cashier'));

create policy sales_return_items_read on sales_return_items for select using (is_active_user());
create policy sales_return_items_write on sales_return_items for insert with check (my_role() in ('owner','admin','accountant','cashier'));

create policy purchase_returns_read on purchase_returns for select using (is_active_user());
create policy purchase_returns_write on purchase_returns for insert with check (my_role() in ('owner','admin','accountant'));

create policy purchase_return_items_read on purchase_return_items for select using (is_active_user());
create policy purchase_return_items_write on purchase_return_items for insert with check (my_role() in ('owner','admin','accountant'));

create policy debt_payments_read on debt_payments for select using (is_active_user());
create policy debt_payments_write on debt_payments for insert with check (my_role() in ('owner','admin','accountant','cashier'));

create policy expense_categories_read on expense_categories for select using (is_active_user());
create policy expense_categories_write on expense_categories for all using (my_role() in ('owner','admin','accountant'));

create policy expenses_read on expenses for select using (is_active_user());
create policy expenses_write on expenses for insert with check (my_role() in ('owner','admin','accountant'));

create policy audit_log_read on audit_log for select using (my_role() in ('owner','admin'));
create policy audit_log_write on audit_log for insert with check (is_active_user());

create policy notifications_own on notifications for all using (user_id = auth.uid());

create policy backup_log_read on backup_log for select using (my_role() in ('owner','admin'));
create policy backup_log_write on backup_log for insert with check (is_active_user());

-- ============================================================================
-- SEED: default expense categories (optional, safe to edit/remove)
-- ============================================================================
insert into expense_categories (name) values
  ('إيجار'), ('كهرباء وماء'), ('رواتب'), ('صيانة'), ('نقل ومواصلات'), ('أخرى')
on conflict do nothing;
