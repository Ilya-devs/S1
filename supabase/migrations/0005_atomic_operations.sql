-- ILYA SaaS — 0005 atomic business operations and audit hardening
-- Apply AFTER 0004_multitenant_saas.sql.
-- All financial writes below are server-side, tenant-scoped and atomic.

begin;

-- Fail with a precise migration-order message instead of a cryptic
-- "column organization_id does not exist" error.
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'organization_id'
  ) then
    raise exception 'Migration 0004 must complete successfully before 0005. Run the repaired 0004_multitenant_saas.sql first.';
  end if;
end $$;

-- Snapshot cost on sales returns as well, so returned stock reduces COGS correctly.
alter table public.sales_return_items
  add column if not exists unit_cost_iqd bigint not null default 0;

create or replace function public.snapshot_sales_return_cost()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select p.cost_price_iqd into new.unit_cost_iqd
  from public.products p
  where p.id = new.product_id
    and p.organization_id = new.organization_id;
  if new.unit_cost_iqd is null then raise exception 'Product cost is unavailable'; end if;
  return new;
end;
$$;

drop trigger if exists trg_snapshot_sales_return_cost on public.sales_return_items;
create trigger trg_snapshot_sales_return_cost
before insert on public.sales_return_items
for each row execute function public.snapshot_sales_return_cost();

create index if not exists idx_sales_returns_items_org on public.sales_return_items(organization_id);

update public.sales_return_items i
set unit_cost_iqd = p.cost_price_iqd
from public.products p
where i.product_id=p.id and i.organization_id=p.organization_id and i.unit_cost_iqd=0;

-- Snapshot cost on sale lines so gross profit is based on COGS, not total purchases.
alter table public.sales_invoice_items
  add column if not exists unit_cost_iqd bigint not null default 0;

create or replace function public.snapshot_sale_item_cost()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  select p.cost_price_iqd into new.unit_cost_iqd
  from public.products p
  where p.id = new.product_id
    and p.organization_id = new.organization_id;
  if new.unit_cost_iqd is null then
    raise exception 'Product cost is unavailable';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_snapshot_sale_item_cost on public.sales_invoice_items;
create trigger trg_snapshot_sale_item_cost
before insert on public.sales_invoice_items
for each row execute function public.snapshot_sale_item_cost();

create index if not exists idx_sales_items_org on public.sales_invoice_items(organization_id);

update public.sales_invoice_items i
set unit_cost_iqd = p.cost_price_iqd
from public.products p
where i.product_id = p.id
  and i.organization_id = p.organization_id
  and i.unit_cost_iqd = 0;

create or replace function public.create_sales_invoice(
  p_invoice_number text,
  p_customer_id uuid,
  p_payment_method public.payment_method,
  p_discount_iqd bigint default 0,
  p_paid_iqd bigint default 0,
  p_notes text default null,
  p_client_local_id text default null,
  p_items jsonb default '[]'::jsonb
)
returns public.sales_invoices
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  org uuid := public.current_organization_id();
  result public.sales_invoices;
  item jsonb;
  product_id uuid;
  qty numeric;
  unit_price bigint;
  subtotal bigint := 0;
  total bigint;
  paid bigint;
begin
  if org is null or public.my_role() not in ('owner','admin','accountant','cashier') then
    raise exception 'Not authorized';
  end if;
  if coalesce(length(trim(p_invoice_number)),0) < 2 then raise exception 'Invoice number is required'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'At least one item is required'; end if;
  if p_discount_iqd < 0 or p_paid_iqd < 0 then raise exception 'Invalid invoice amounts'; end if;

  if p_client_local_id is not null then
    select * into result from public.sales_invoices
    where organization_id = org and client_local_id = p_client_local_id
    limit 1;
    if result.id is not null then return result; end if;
  end if;

  for item in select * from jsonb_array_elements(p_items) loop
    product_id := (item->>'product_id')::uuid;
    qty := (item->>'quantity')::numeric;
    unit_price := (item->>'unit_price_iqd')::bigint;
    if qty <= 0 or unit_price < 0 then raise exception 'Invalid sale item'; end if;

    if not exists (
      select 1 from public.products
      where id = product_id and organization_id = org and is_active
    ) then raise exception 'Product is not available'; end if;

    subtotal := subtotal + round(qty * unit_price);
  end loop;

  if p_discount_iqd > subtotal then raise exception 'Discount cannot exceed subtotal'; end if;
  total := subtotal - p_discount_iqd;
  paid := case p_payment_method
    when 'cash' then total
    when 'credit' then 0
    else p_paid_iqd
  end;

  if paid < 0 or paid > total then raise exception 'Paid amount is invalid'; end if;
  if p_payment_method in ('credit','partial') and p_customer_id is null then
    raise exception 'Customer is required for credit or partial payment';
  end if;

  if p_payment_method = 'partial' and (paid = 0 or paid >= total) then
    raise exception 'Partial payment must be between zero and total';
  end if;

  if p_customer_id is not null and not exists (
    select 1 from public.customers where id = p_customer_id and organization_id = org and is_active
  ) then raise exception 'Customer is not available'; end if;

  insert into public.sales_invoices(
    organization_id, invoice_number, customer_id, status, payment_method,
    subtotal_iqd, discount_iqd, total_iqd, paid_iqd, notes, client_local_id, created_by
  ) values (
    org, trim(p_invoice_number), p_customer_id, 'confirmed', p_payment_method,
    subtotal, p_discount_iqd, total, paid, nullif(trim(p_notes),''), p_client_local_id, auth.uid()
  ) returning * into result;

  for item in select * from jsonb_array_elements(p_items) loop
    insert into public.sales_invoice_items(
      organization_id, invoice_id, product_id, quantity, unit_price_iqd, unit_cost_iqd
    )
    select
      org, result.id, (item->>'product_id')::uuid, (item->>'quantity')::numeric,
      (item->>'unit_price_iqd')::bigint, p.cost_price_iqd
    from public.products p
    where p.id = (item->>'product_id')::uuid and p.organization_id = org;
  end loop;

  return result;
end;
$$;

create or replace function public.create_purchase_invoice(
  p_invoice_number text,
  p_supplier_id uuid,
  p_payment_method public.payment_method,
  p_discount_iqd bigint default 0,
  p_paid_iqd bigint default 0,
  p_notes text default null,
  p_client_local_id text default null,
  p_items jsonb default '[]'::jsonb
)
returns public.purchase_invoices
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  org uuid := public.current_organization_id();
  result public.purchase_invoices;
  item jsonb;
  subtotal bigint := 0;
  total bigint;
  paid bigint;
  qty numeric;
  unit_cost bigint;
begin
  if org is null or public.my_role() not in ('owner','admin','accountant') then raise exception 'Not authorized'; end if;
  if coalesce(length(trim(p_invoice_number)),0) < 2 then raise exception 'Invoice number is required'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'At least one item is required'; end if;
  if p_discount_iqd < 0 or p_paid_iqd < 0 then raise exception 'Invalid invoice amounts'; end if;

  if p_client_local_id is not null then
    select * into result from public.purchase_invoices
    where organization_id = org and client_local_id = p_client_local_id limit 1;
    if result.id is not null then return result; end if;
  end if;

  for item in select * from jsonb_array_elements(p_items) loop
    qty := (item->>'quantity')::numeric;
    unit_cost := (item->>'unit_cost_iqd')::bigint;
    if qty <= 0 or unit_cost < 0 then raise exception 'Invalid purchase item'; end if;
    if not exists (select 1 from public.products where id = (item->>'product_id')::uuid and organization_id = org and is_active) then
      raise exception 'Product is not available';
    end if;
    subtotal := subtotal + round(qty * unit_cost);
  end loop;

  if p_discount_iqd > subtotal then raise exception 'Discount cannot exceed subtotal'; end if;
  total := subtotal - p_discount_iqd;
  paid := case p_payment_method when 'cash' then total when 'credit' then 0 else p_paid_iqd end;
  if paid < 0 or paid > total then raise exception 'Paid amount is invalid'; end if;
  if p_payment_method in ('credit','partial') and p_supplier_id is null then raise exception 'Supplier is required for credit or partial payment'; end if;
  if p_payment_method = 'partial' and (paid = 0 or paid >= total) then raise exception 'Partial payment must be between zero and total'; end if;
  if p_supplier_id is not null and not exists (select 1 from public.suppliers where id=p_supplier_id and organization_id=org and is_active) then
    raise exception 'Supplier is not available';
  end if;

  insert into public.purchase_invoices(
    organization_id, invoice_number, supplier_id, status, payment_method,
    subtotal_iqd, discount_iqd, total_iqd, paid_iqd, notes, client_local_id, created_by
  ) values (
    org, trim(p_invoice_number), p_supplier_id, 'confirmed', p_payment_method,
    subtotal, p_discount_iqd, total, paid, nullif(trim(p_notes),''), p_client_local_id, auth.uid()
  ) returning * into result;

  for item in select * from jsonb_array_elements(p_items) loop
    insert into public.purchase_invoice_items(
      organization_id, invoice_id, product_id, quantity, unit_cost_iqd
    ) values (
      org, result.id, (item->>'product_id')::uuid, (item->>'quantity')::numeric, (item->>'unit_cost_iqd')::bigint
    );
  end loop;

  return result;
end;
$$;

create or replace function public.adjust_stock(
  p_product_id uuid,
  p_quantity_delta numeric,
  p_note text default null
)
returns public.products
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  org uuid := public.current_organization_id();
  result public.products;
  old_qty numeric;
begin
  if org is null or public.my_role() not in ('owner','admin','accountant') then raise exception 'Not authorized'; end if;
  if p_quantity_delta = 0 then raise exception 'Adjustment cannot be zero'; end if;

  select quantity_on_hand into old_qty from public.products
  where id = p_product_id and organization_id = org and is_active for update;
  if not found then raise exception 'Product is not available'; end if;
  if old_qty + p_quantity_delta < 0 then raise exception 'Stock cannot become negative'; end if;

  update public.products set quantity_on_hand = old_qty + p_quantity_delta where id=p_product_id and organization_id=org returning * into result;
  insert into public.stock_movements(organization_id, product_id, movement_type, quantity_delta, reference_table, note, created_by)
  values (org, p_product_id, 'adjustment', p_quantity_delta, 'products', nullif(trim(p_note),''), auth.uid());
  return result;
end;
$$;

create or replace function public.record_debt_payment(
  p_direction public.payment_direction,
  p_customer_id uuid default null,
  p_supplier_id uuid default null,
  p_amount_iqd bigint default 0,
  p_method text default 'cash',
  p_note text default null
)
returns public.debt_payments
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  org uuid := public.current_organization_id();
  result public.debt_payments;
  balance bigint;
begin
  if org is null or public.my_role() not in ('owner','admin','accountant','cashier') then raise exception 'Not authorized'; end if;
  if p_amount_iqd <= 0 then raise exception 'Payment must be greater than zero'; end if;

  if p_direction = 'from_customer' then
    if p_customer_id is null or p_supplier_id is not null then raise exception 'Invalid customer payment'; end if;
    select balance_iqd into balance from public.customer_balances
    where customer_id=p_customer_id;
    if balance is null then raise exception 'Customer is not available'; end if;
    if p_amount_iqd > balance then raise exception 'Payment exceeds customer balance'; end if;
  elsif p_direction = 'to_supplier' then
    if p_supplier_id is null or p_customer_id is not null then raise exception 'Invalid supplier payment'; end if;
    select balance_iqd into balance from public.supplier_balances
    where supplier_id=p_supplier_id;
    if balance is null then raise exception 'Supplier is not available'; end if;
    if p_amount_iqd > balance then raise exception 'Payment exceeds supplier balance'; end if;
  else
    raise exception 'Invalid payment direction';
  end if;

  insert into public.debt_payments(organization_id,direction,customer_id,supplier_id,amount_iqd,method,note,created_by)
  values (org,p_direction,p_customer_id,p_supplier_id,p_amount_iqd,left(trim(coalesce(p_method,'cash')),30),nullif(trim(p_note),''),auth.uid())
  returning * into result;
  return result;
end;
$$;

revoke all on function public.create_sales_invoice(text,uuid,public.payment_method,bigint,bigint,text,text,jsonb) from public;
grant execute on function public.create_sales_invoice(text,uuid,public.payment_method,bigint,bigint,text,text,jsonb) to authenticated;
revoke all on function public.create_purchase_invoice(text,uuid,public.payment_method,bigint,bigint,text,text,jsonb) from public;
grant execute on function public.create_purchase_invoice(text,uuid,public.payment_method,bigint,bigint,text,text,jsonb) to authenticated;
revoke all on function public.adjust_stock(uuid,numeric,text) from public;
grant execute on function public.adjust_stock(uuid,numeric,text) to authenticated;
revoke all on function public.record_debt_payment(public.payment_direction,uuid,uuid,bigint,text,text) from public;
grant execute on function public.record_debt_payment(public.payment_direction,uuid,uuid,bigint,text,text) to authenticated;


-- Notify every active member only when stock crosses from healthy to low.
create or replace function public.notify_low_stock()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.quantity_on_hand <= new.reorder_point
     and old.quantity_on_hand > old.reorder_point then
    insert into public.notifications(organization_id, user_id, title, body)
    select new.organization_id, om.user_id, 'تنبيه مخزون منخفض',
           'المنتج "' || new.name || '" وصل إلى ' || new.quantity_on_hand || ' ' || new.unit || '.'
    from public.organization_members om
    where om.organization_id = new.organization_id
      and om.is_active;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_low_stock on public.products;
create trigger trg_notify_low_stock
after update of quantity_on_hand on public.products
for each row execute function public.notify_low_stock();


create or replace function public.log_backup(
  p_status text,
  p_file_size_bytes bigint default null
)
returns public.backup_log
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  org uuid := public.current_organization_id();
  result public.backup_log;
begin
  if org is null or public.my_role() not in ('owner','admin') then raise exception 'Not authorized'; end if;
  if p_status not in ('success','failed') then raise exception 'Invalid backup status'; end if;
  insert into public.backup_log(organization_id,triggered_by,status,file_size_bytes)
  values(org,auth.uid(),p_status,p_file_size_bytes)
  returning * into result;
  return result;
end;
$$;
revoke all on function public.log_backup(text,bigint) from public;
grant execute on function public.log_backup(text,bigint) to authenticated;

-- Audit all critical business writes. The trigger is intentionally minimal and
-- records only metadata; it never stores passwords, tokens or secret values.
create or replace function public.audit_business_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  org uuid := public.current_organization_id();
begin
  if org is not null then
    insert into public.audit_log(organization_id, actor_id, action, entity_table, entity_id, details)
    values (
      org, auth.uid(), lower(tg_op), tg_table_name(), coalesce(new.id, old.id),
      jsonb_build_object('at', now())
    );
  end if;
  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'customers','suppliers','product_categories','products',
    'sales_invoices','purchase_invoices','sales_returns','purchase_returns',
    'debt_payments','expenses'
  ] loop
    execute format('drop trigger if exists trg_audit_business_write on public.%I', t);
    execute format('create trigger trg_audit_business_write after insert or update or delete on public.%I for each row execute function public.audit_business_write()', t);
  end loop;
end $$;


create or replace function public.create_product(
  p_name text,
  p_sku text default null,
  p_barcode text default null,
  p_unit text default 'قطعة',
  p_cost_price_iqd bigint default 0,
  p_sale_price_iqd bigint default 0,
  p_initial_quantity numeric default 0,
  p_reorder_point numeric default 5
)
returns public.products
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  org uuid := public.current_organization_id();
  result public.products;
begin
  if org is null or public.my_role() not in ('owner','admin','accountant') then raise exception 'Not authorized'; end if;
  if length(trim(coalesce(p_name,''))) < 1 then raise exception 'Product name is required'; end if;
  if p_cost_price_iqd < 0 or p_sale_price_iqd < 0 or p_initial_quantity < 0 or p_reorder_point < 0 then
    raise exception 'Product values cannot be negative';
  end if;

  insert into public.products(
    organization_id,name,sku,barcode,unit,cost_price_iqd,sale_price_iqd,quantity_on_hand,reorder_point,created_by
  ) values (
    org,left(trim(p_name),200),nullif(trim(p_sku),''),nullif(trim(p_barcode),''),
    left(trim(coalesce(p_unit,'قطعة')),50),p_cost_price_iqd,p_sale_price_iqd,0,p_reorder_point,auth.uid()
  ) returning * into result;

  if p_initial_quantity > 0 then
    update public.products set quantity_on_hand=p_initial_quantity where id=result.id returning * into result;
    insert into public.stock_movements(organization_id,product_id,movement_type,quantity_delta,reference_table,note,created_by)
    values (org,result.id,'adjustment',p_initial_quantity,'products','الرصيد الافتتاحي',auth.uid());
  end if;
  return result;
end;
$$;

revoke all on function public.create_product(text,text,text,text,bigint,bigint,numeric,numeric) from public;
grant execute on function public.create_product(text,text,text,text,bigint,bigint,numeric,numeric) to authenticated;

-- Atomic returns. Prevents orphan headers and validates the original invoice when provided.
create or replace function public.create_sales_return(
  p_return_number text,
  p_original_invoice_id uuid default null,
  p_customer_id uuid default null,
  p_reason text default null,
  p_items jsonb default '[]'::jsonb
)
returns public.sales_returns
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  org uuid := public.current_organization_id();
  result public.sales_returns;
  item jsonb;
  qty numeric;
  unit_price bigint;
  total bigint := 0;
  sold_qty numeric;
  already_returned numeric;
begin
  if org is null or public.my_role() not in ('owner','admin','accountant','cashier') then raise exception 'Not authorized'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then raise exception 'At least one item is required'; end if;

  if p_original_invoice_id is not null and not exists (
    select 1 from public.sales_invoices
    where id=p_original_invoice_id and organization_id=org and status='confirmed'
  ) then raise exception 'Original sales invoice is not available'; end if;

  if p_customer_id is not null and not exists (
    select 1 from public.customers where id=p_customer_id and organization_id=org and is_active
  ) then raise exception 'Customer is not available'; end if;

  for item in select * from jsonb_array_elements(p_items) loop
    qty := (item->>'quantity')::numeric;
    unit_price := (item->>'unit_price_iqd')::bigint;
    if qty <= 0 or unit_price < 0 then raise exception 'Invalid return item'; end if;
    if not exists (select 1 from public.products where id=(item->>'product_id')::uuid and organization_id=org and is_active) then
      raise exception 'Product is not available';
    end if;

    if p_original_invoice_id is not null then
      select coalesce(sum(quantity),0) into sold_qty
      from public.sales_invoice_items
      where invoice_id=p_original_invoice_id and product_id=(item->>'product_id')::uuid and organization_id=org;
      select coalesce(sum(sri.quantity),0) into already_returned
      from public.sales_return_items sri
      join public.sales_returns sr on sr.id=sri.return_id
      where sr.original_invoice_id=p_original_invoice_id
        and sri.product_id=(item->>'product_id')::uuid
        and sri.organization_id=org;
      if qty + already_returned > sold_qty then raise exception 'Return quantity exceeds original sale'; end if;
    end if;
    total := total + round(qty * unit_price);
  end loop;

  insert into public.sales_returns(organization_id,return_number,original_invoice_id,customer_id,total_iqd,reason,created_by)
  values (org,trim(p_return_number),p_original_invoice_id,p_customer_id,total,nullif(trim(p_reason),''),auth.uid())
  returning * into result;

  for item in select * from jsonb_array_elements(p_items) loop
    insert into public.sales_return_items(organization_id,return_id,product_id,quantity,unit_price_iqd,unit_cost_iqd)
    select org,result.id,(item->>'product_id')::uuid,(item->>'quantity')::numeric,(item->>'unit_price_iqd')::bigint,p.cost_price_iqd
    from public.products p
    where p.id=(item->>'product_id')::uuid and p.organization_id=org;
  end loop;
  return result;
end;
$$;

create or replace function public.create_purchase_return(
  p_return_number text,
  p_original_invoice_id uuid default null,
  p_supplier_id uuid default null,
  p_reason text default null,
  p_items jsonb default '[]'::jsonb
)
returns public.purchase_returns
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  org uuid := public.current_organization_id();
  result public.purchase_returns;
  item jsonb;
  qty numeric;
  unit_cost bigint;
  total bigint := 0;
begin
  if org is null or public.my_role() not in ('owner','admin','accountant') then raise exception 'Not authorized'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then raise exception 'At least one item is required'; end if;

  if p_original_invoice_id is not null and not exists (
    select 1 from public.purchase_invoices where id=p_original_invoice_id and organization_id=org and status='confirmed'
  ) then raise exception 'Original purchase invoice is not available'; end if;

  if p_supplier_id is not null and not exists (
    select 1 from public.suppliers where id=p_supplier_id and organization_id=org and is_active
  ) then raise exception 'Supplier is not available'; end if;

  for item in select * from jsonb_array_elements(p_items) loop
    qty := (item->>'quantity')::numeric;
    unit_cost := (item->>'unit_cost_iqd')::bigint;
    if qty <= 0 or unit_cost < 0 then raise exception 'Invalid return item'; end if;
    if not exists (select 1 from public.products where id=(item->>'product_id')::uuid and organization_id=org and is_active) then
      raise exception 'Product is not available'; end if;
    total := total + round(qty * unit_cost);
  end loop;

  insert into public.purchase_returns(organization_id,return_number,original_invoice_id,supplier_id,total_iqd,reason,created_by)
  values (org,trim(p_return_number),p_original_invoice_id,p_supplier_id,total,nullif(trim(p_reason),''),auth.uid())
  returning * into result;

  for item in select * from jsonb_array_elements(p_items) loop
    insert into public.purchase_return_items(organization_id,return_id,product_id,quantity,unit_cost_iqd)
    values (org,result.id,(item->>'product_id')::uuid,(item->>'quantity')::numeric,(item->>'unit_cost_iqd')::bigint);
  end loop;
  return result;
end;
$$;

revoke all on function public.create_sales_return(text,uuid,uuid,text,jsonb) from public;
grant execute on function public.create_sales_return(text,uuid,uuid,text,jsonb) to authenticated;
revoke all on function public.create_purchase_return(text,uuid,uuid,text,jsonb) from public;
grant execute on function public.create_purchase_return(text,uuid,uuid,text,jsonb) to authenticated;

commit;
