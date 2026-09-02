-- ILYA Accounting — 0002 hardening
-- Apply AFTER 0001_init.sql.
-- This migration is safe to run repeatedly and does not delete business data.

begin;

-- ---------------------------------------------------------------------------
-- 1. Prevent direct client writes to the stock ledger.
-- Stock movements must be produced by trusted database triggers.
-- 0001 created this policy, so remove it before replacing the rule.
-- ---------------------------------------------------------------------------
drop policy if exists stock_movements_write on public.stock_movements;

-- ---------------------------------------------------------------------------
-- 2. Make stock trigger functions trusted and explicit.
-- SECURITY DEFINER is required because the caller (e.g. cashier) is not
-- allowed to insert into stock_movements directly.
-- ---------------------------------------------------------------------------
create or replace function public.apply_sale_item_stock()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.quantity <= 0 then
    raise exception 'Sale quantity must be greater than zero';
  end if;

  update public.products
  set quantity_on_hand = quantity_on_hand - new.quantity
  where id = new.product_id
    and quantity_on_hand >= new.quantity;

  if not found then
    raise exception 'Insufficient stock for product %', new.product_id;
  end if;

  insert into public.stock_movements(
    product_id, movement_type, quantity_delta, reference_table, reference_id, created_by
  )
  values (
    new.product_id, 'sale', -new.quantity, 'sales_invoices', new.invoice_id, auth.uid()
  );

  return new;
end;
$$;

create or replace function public.apply_purchase_item_stock()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.quantity <= 0 then
    raise exception 'Purchase quantity must be greater than zero';
  end if;

  update public.products
  set quantity_on_hand = quantity_on_hand + new.quantity
  where id = new.product_id;

  if not found then
    raise exception 'Product % does not exist', new.product_id;
  end if;

  insert into public.stock_movements(
    product_id, movement_type, quantity_delta, reference_table, reference_id, created_by
  )
  values (
    new.product_id, 'purchase', new.quantity, 'purchase_invoices', new.invoice_id, auth.uid()
  );

  return new;
end;
$$;

create or replace function public.apply_sale_return_stock()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.quantity <= 0 then
    raise exception 'Return quantity must be greater than zero';
  end if;

  update public.products
  set quantity_on_hand = quantity_on_hand + new.quantity
  where id = new.product_id;

  if not found then
    raise exception 'Product % does not exist', new.product_id;
  end if;

  insert into public.stock_movements(
    product_id, movement_type, quantity_delta, reference_table, reference_id, created_by
  )
  values (
    new.product_id, 'sale_return', new.quantity, 'sales_returns', new.return_id, auth.uid()
  );

  return new;
end;
$$;

create or replace function public.apply_purchase_return_stock()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.quantity <= 0 then
    raise exception 'Return quantity must be greater than zero';
  end if;

  update public.products
  set quantity_on_hand = quantity_on_hand - new.quantity
  where id = new.product_id
    and quantity_on_hand >= new.quantity;

  if not found then
    raise exception 'Insufficient stock for purchase return, product %', new.product_id;
  end if;

  insert into public.stock_movements(
    product_id, movement_type, quantity_delta, reference_table, reference_id, created_by
  )
  values (
    new.product_id, 'purchase_return', -new.quantity, 'purchase_returns', new.return_id, auth.uid()
  );

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Future-row data integrity. NOT VALID avoids rewriting/rejecting existing
-- data during deployment. These constraints can be validated separately after
-- existing data has been reviewed.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.products'::regclass
      and conname = 'products_nonnegative_stock'
  ) then
    alter table public.products
      add constraint products_nonnegative_stock
      check (quantity_on_hand >= 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.products'::regclass
      and conname = 'products_nonnegative_prices'
  ) then
    alter table public.products
      add constraint products_nonnegative_prices
      check (cost_price_iqd >= 0 and sale_price_iqd >= 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.sales_invoices'::regclass
      and conname = 'sales_invoice_amounts_valid'
  ) then
    alter table public.sales_invoices
      add constraint sales_invoice_amounts_valid
      check (
        subtotal_iqd >= 0
        and discount_iqd >= 0
        and total_iqd >= 0
        and paid_iqd >= 0
        and paid_iqd <= total_iqd
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.purchase_invoices'::regclass
      and conname = 'purchase_invoice_amounts_valid'
  ) then
    alter table public.purchase_invoices
      add constraint purchase_invoice_amounts_valid
      check (
        subtotal_iqd >= 0
        and discount_iqd >= 0
        and total_iqd >= 0
        and paid_iqd >= 0
        and paid_iqd <= total_iqd
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.sales_invoice_items'::regclass
      and conname = 'sales_item_positive_values'
  ) then
    alter table public.sales_invoice_items
      add constraint sales_item_positive_values
      check (quantity > 0 and unit_price_iqd >= 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.purchase_invoice_items'::regclass
      and conname = 'purchase_item_positive_values'
  ) then
    alter table public.purchase_invoice_items
      add constraint purchase_item_positive_values
      check (quantity > 0 and unit_cost_iqd >= 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.sales_return_items'::regclass
      and conname = 'sales_return_item_positive_values'
  ) then
    alter table public.sales_return_items
      add constraint sales_return_item_positive_values
      check (quantity > 0 and unit_price_iqd >= 0) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.purchase_return_items'::regclass
      and conname = 'purchase_return_item_positive_values'
  ) then
    alter table public.purchase_return_items
      add constraint purchase_return_item_positive_values
      check (quantity > 0 and unit_cost_iqd >= 0) not valid;
  end if;
end $$;

commit;
