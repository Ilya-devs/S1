# ILYA — Migration recovery

## Current required order

1. `0001_init.sql` — only once on a fresh database.
2. `0002_hardening.sql`
3. `0003_auth_profile_provisioning.sql`
4. `0004_multitenant_saas.sql`
5. `0005_atomic_operations.sql`

## If 0004 previously failed with `products_sku_key`

The previous version attempted to drop a backing index that is owned by a UNIQUE constraint. PostgreSQL rejects that operation with SQLSTATE `2BP01`.

The repaired `0004_multitenant_saas.sql` drops the owning UNIQUE constraints first and then removes any remaining standalone legacy indexes.

Because the migration is wrapped in a transaction, a normal SQL Editor failure rolls the migration back. Do not run 0005 until 0004 completes successfully.

## Verification after 0004

Run:

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'products'
  and column_name = 'organization_id';
```

It must return one row.

Then run `0005_atomic_operations.sql`.

## Data safety

These migrations intentionally do not reset the database or delete business rows. Do not use a database reset as a troubleshooting shortcut.
