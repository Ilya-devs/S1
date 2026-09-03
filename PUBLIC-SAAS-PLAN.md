# ILYA Public SaaS Architecture Plan

## Current implementation
The browser uses the Supabase publishable key and project URL as a public client configuration fallback. These values are not secrets. Supabase explicitly documents that publishable keys are intended for browser applications; security must be enforced with Auth, grants, and RLS.

Cloudflare environment variables remain supported and override the built-in public configuration when present.

## Required next vertical slice: multi-tenant workspaces
The current database is a single-workspace accounting schema. Converting it safely to a public SaaS platform requires a database migration and UI changes together.

Target model:

organization
  -> organization_members
  -> invitations
  -> users/profiles

Every tenant-owned accounting record must carry organization_id and every RLS policy must enforce membership.

Do not deploy a partial tenant migration. It must be implemented and verified end-to-end.

## Planned product capabilities (not claimed as implemented)
1. Organization/workspace creation
2. Workspace switcher
3. Employee invitations
4. Role-based permissions
5. Custom roles/permissions
6. Employee activation/deactivation
7. Audit log
8. Login/session management
9. Device/session management
10. Password reset
11. Email confirmation
12. Customer management
13. Supplier management
14. Product catalog
15. Barcode support
16. Categories
17. Stock ledger
18. Stock adjustments
19. Sales invoices
20. Purchase invoices
21. Sales returns
22. Purchase returns
23. Customer debts
24. Supplier debts
25. Payments
26. Expenses
27. Dashboard
28. Profit/loss reporting
29. Inventory reporting
30. Debt reporting
31. Date-range reporting
32. Invoice printing/PDF
33. Data export
34. Data import
35. Backup/restore
36. Organization settings
37. Company branding
38. Low-stock alerts
39. Search/filtering
40. Mobile responsive UI
41. PWA installation
42. Offline-safe drafts
43. Idempotent invoice creation
44. Error boundary/diagnostics
45. Health/configuration diagnostics
46. Security/RLS regression tests
47. Tenant-isolation tests
48. Migration verification
49. Build/deployment verification
50. Activity/operation identifiers

These are a roadmap, not a claim that all 50 are currently implemented.
