-- ILYA hardening migration.
-- Safe to apply after 0001_init.sql. No existing data is deleted.

-- Do not allow normal clients to manufacture stock movements directly.
drop policy if exists stock_movements_write on stock_movements;

-- Stock movements are written by controlled trigger functions only.
-- Keep reads available to active users.
create policy stock_movements_read on stock_movements
  for select using (is_active_user());

-- Tighten profile visibility: a user can see their own profile; only owner/admin
-- can see the team. This also avoids exposing phone/avatar data to viewers.
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles
  for select using (id = auth.uid() or my_role() in ('owner', 'admin'));

-- Prevent negative/invalid monetary values at the database boundary.
alter table sales_invoices
  drop constraint if exists sales_paid_not_over_total;
alter table sales_invoices
  add constraint sales_paid_not_over_total check (paid_iqd >= 0 and paid_iqd <= total_iqd);

alter table purchase_invoices
  drop constraint if exists purchase_paid_not_over_total;
alter table purchase_invoices
  add constraint purchase_paid_not_over_total check (paid_iqd >= 0 and paid_iqd <= total_iqd);

alter table sales_invoices
  drop constraint if exists sales_amounts_nonnegative;
alter table sales_invoices
  add constraint sales_amounts_nonnegative check (subtotal_iqd >= 0 and discount_iqd >= 0 and total_iqd >= 0);

alter table purchase_invoices
  drop constraint if exists purchase_amounts_nonnegative;
alter table purchase_invoices
  add constraint purchase_amounts_nonnegative check (subtotal_iqd >= 0 and discount_iqd >= 0 and total_iqd >= 0);

alter table sales_invoice_items
  drop constraint if exists sales_item_quantity_positive;
alter table sales_invoice_items
  add constraint sales_item_quantity_positive check (quantity > 0);

alter table purchase_invoice_items
  drop constraint if exists purchase_item_quantity_positive;
alter table purchase_invoice_items
  add constraint purchase_item_quantity_positive check (quantity > 0);

alter table sales_return_items
  drop constraint if exists sales_return_quantity_positive;
alter table sales_return_items
  add constraint sales_return_quantity_positive check (quantity > 0);

alter table purchase_return_items
  drop constraint if exists purchase_return_quantity_positive;
alter table purchase_return_items
  add constraint purchase_return_quantity_positive check (quantity > 0);

-- Trigger functions must be able to update stock for cashiers while still
-- exposing no generic privileged RPC to the browser.
create or replace function apply_sale_item_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  available numeric;
  invoice_status_value invoice_status;
begin
  select status into invoice_status_value
  from sales_invoices
  where id = new.invoice_id;

  if invoice_status_value is distinct from 'confirmed' then
    raise exception 'Sales items can only be added to a confirmed invoice';
  end if;

  select quantity_on_hand into available
  from products
  where id = new.product_id
  for update;

  if available is null then
    raise exception 'Product not found';
  end if;

  if available < new.quantity then
    raise exception 'Insufficient stock for product %', new.product_id;
  end if;

  update products
  set quantity_on_hand = quantity_on_hand - new.quantity
  where id = new.product_id;

  insert into stock_movements(product_id, movement_type, quantity_delta, reference_table, reference_id, created_by)
  values (new.product_id, 'sale', -new.quantity, 'sales_invoices', new.invoice_id, auth.uid());

  return new;
end;
$$;

create or replace function apply_purchase_item_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invoice_status_value invoice_status;
begin
  select status into invoice_status_value
  from purchase_invoices
  where id = new.invoice_id;

  if invoice_status_value is distinct from 'confirmed' then
    raise exception 'Purchase items can only be added to a confirmed invoice';
  end if;

  update products
  set quantity_on_hand = quantity_on_hand + new.quantity
  where id = new.product_id;

  if not found then
    raise exception 'Product not found';
  end if;

  insert into stock_movements(product_id, movement_type, quantity_delta, reference_table, reference_id, created_by)
  values (new.product_id, 'purchase', new.quantity, 'purchase_invoices', new.invoice_id, auth.uid());

  return new;
end;
$$;

create or replace function apply_sale_return_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update products
  set quantity_on_hand = quantity_on_hand + new.quantity
  where id = new.product_id;

  if not found then
    raise exception 'Product not found';
  end if;

  insert into stock_movements(product_id, movement_type, quantity_delta, reference_table, reference_id, created_by)
  values (new.product_id, 'sale_return', new.quantity, 'sales_returns', new.return_id, auth.uid());

  return new;
end;
$$;

create or replace function apply_purchase_return_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  available numeric;
begin
  select quantity_on_hand into available
  from products
  where id = new.product_id
  for update;

  if available is null then
    raise exception 'Product not found';
  end if;

  if available < new.quantity then
    raise exception 'Insufficient stock for purchase return';
  end if;

  update products
  set quantity_on_hand = quantity_on_hand - new.quantity
  where id = new.product_id;

  insert into stock_movements(product_id, movement_type, quantity_delta, reference_table, reference_id, created_by)
  values (new.product_id, 'purchase_return', -new.quantity, 'purchase_returns', new.return_id, auth.uid());

  return new;
end;
$$;

-- Only the trigger path should write stock movements.
revoke insert on stock_movements from anon, authenticated;
