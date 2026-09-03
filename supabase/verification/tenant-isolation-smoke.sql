-- ILYA tenant-isolation smoke checks
-- Run as an authenticated user in Supabase SQL editor only when testing with a
-- test account. These checks intentionally reveal no business rows.

select public.current_organization_id() as active_organization;
select public.my_role() as active_role;

select count(*) as visible_customers from public.customers;
select count(*) as visible_products from public.products;
select count(*) as visible_sales from public.sales_invoices;

-- Expected invariant:
-- 1) active_organization_id is non-null for an active application user.
-- 2) every visible tenant table row belongs to active_organization_id.
-- 3) switching to another organization changes the visible row set.
