# ILYA Public SaaS — Architecture & Delivery Status

## Implemented foundation

ILYA is a multi-tenant accounting SaaS. Each registered account receives a private organization automatically. Existing legacy data is migrated into one legacy organization.

Security boundary:

```text
Supabase Auth
   ↓
profiles
   ↓
organization_members
   ↓
active_organization_id
   ↓
RLS on every tenant-owned table
```

The browser can send arbitrary `organization_id`, but database triggers overwrite it on insert and reject tenant changes on update. Privileged financial operations are server-side PostgreSQL functions and are atomic.

## Implemented product capabilities

1. Public account registration
2. Email/password login
3. Password reset
4. Email-confirmation compatible flow
5. Automatic profile provisioning
6. Automatic private workspace creation
7. Workspace switcher
8. Multiple workspaces per user
9. Workspace creation
10. Employee invitations with hashed random tokens
11. Invitation acceptance
12. Team/member management
13. Role management
14. Employee activation/deactivation
15. Owner protection (organization cannot lose its last active owner)
16. Tenant-scoped settings
17. Tenant-scoped customers
18. Tenant-scoped suppliers
19. Tenant-scoped products
20. Tenant-scoped stock ledger
21. Tenant-scoped sales
22. Tenant-scoped purchases
23. Tenant-scoped sales returns
24. Tenant-scoped purchase returns
25. Tenant-scoped debt payments
26. Tenant-scoped expenses
27. Stock adjustments
28. Atomic sales invoice creation
29. Atomic purchase invoice creation
30. Atomic returns
31. Server-side stock validation
32. Server-side payment validation
33. Idempotent invoice client IDs
34. Tenant-scoped SKU/barcode uniqueness
35. Tenant-scoped invoice numbering
36. Audit logging of critical business writes
37. Role-based navigation
38. RLS tenant isolation
39. PWA installability
40. Static-only service-worker caching
41. Runtime configuration fallback using public Supabase publishable key
42. Error boundary instead of blank-page failure
43. Startup diagnostics
44. Responsive desktop/tablet/mobile layouts
45. Backup export
46. Date-range reports
47. Low-stock indicators
48. Arabic/IQD-first UX
49. Cloudflare Pages Git integration
50. GitHub build verification

## Security principles

- `sb_publishable_*` is allowed in browser code; it is not a secret.
- Never ship `sb_secret_*`, `service_role`, database passwords or privileged API tokens.
- RLS is the authoritative tenant boundary.
- Client UI restrictions are convenience only; database policies enforce authorization.
- Financial multi-step operations use atomic database functions.
- Invitation plaintext tokens are never stored; only SHA-256 hashes are stored.
- Existing business data is not intentionally deleted by tenant migration.

## Required migration order

1. `0001_init.sql`
2. `0002_hardening.sql`
3. `0003_auth_profile_provisioning.sql`
4. `0004_multitenant_saas.sql`
5. `0005_atomic_operations.sql`
6. `0006_fix_signup_provisioning.sql`

Do not rerun `0001` on an existing database.

## Remaining optional enterprise roadmap

These are deliberately not claimed as implemented until their end-to-end database + UI + test paths exist:

- Subscription/billing plans
- Usage limits
- Super-admin control plane
- Email delivery provider
- Scheduled cloud backups
- PDF server rendering
- CSV/Excel import wizard
- Advanced accounting journal/ledger
- Multi-currency
- Branch-level inventory
- POS barcode scanner integration
- Advanced tax/VAT rules
- Supplier/customer statements as PDFs
- Automated low-stock notifications
- Web push notifications
- Two-factor authentication
- SSO
- Webhooks/API keys
- Rate-limit dashboard
- Full end-to-end browser test suite
