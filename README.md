# ILYA — نظام محاسبي متكامل بالدينار العراقي

مشروع PWA (تطبيق ويب قابل للتثبيت) مبني بـ React + TypeScript + Vite + Tailwind،
ومربوط بقاعدة بيانات Supabase، ومُعد للنشر على Cloudflare Pages.

جميع الحقوق محفوظة — **ILYA dev** — https://ILYA-3.pages.dev/

---

## 1) إعداد Supabase

1. أنشئ مشروعاً جديداً على [supabase.com](https://supabase.com).
2. من قائمة **SQL Editor**، افتح ملف `supabase/migrations/0001_init.sql` من هذا المشروع،
   انسخ محتواه بالكامل، والصقه وشغّله (Run). هذا سينشئ كل الجداول، الصلاحيات (RLS)،
   والعروض (Views) الخاصة بحساب الديون تلقائياً.
3. من **Authentication → Providers**، فعّل تسجيل الدخول بالبريد الإلكتروني وكلمة المرور
   (Email + Password) — وهذا يكفي لأن التطبيق مخصص لك ولعدد محدود من الأجهزة.
4. أنشئ أول مستخدم لك من **Authentication → Users → Add User** (أدخل بريدك وكلمة مرور).
5. بعد إنشاء المستخدم، اذهب إلى **Table Editor → profiles** وأضف صفاً يدوياً:
   - `id` = نفس الـ UUID الخاص بالمستخدم الذي أنشأته في الخطوة السابقة
   - `full_name` = اسمك
   - `role` = `owner`
   - `is_active` = `true`

   (لاحقاً يمكنك إضافة حسابات أخرى بنفس الطريقة بأدوار `admin` أو `accountant` أو `cashier` أو `viewer`)

6. من **Project Settings → API** انسخ القيمتين التاليتين — ستحتاجهما في الخطوة التالية:
   - **Project URL**
   - **anon public key**

---

## 2) رفع المشروع على GitHub

```bash
git init
git add .
git commit -m "ILYA accounting — initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

---

## 3) النشر على Cloudflare Pages ومتغيرات البناء

متغيرات Supabase مفيدة للبناء، لكن `VITE_*` تصل إلى المتصفح في النهاية. لا تضع أي secret/service-role key فيها. المشروع يحتوي fallback عام لمفتاح publishable.

### الطريقة أ — من واجهة Cloudflare (الأسهل)

1. سجّل الدخول إلى [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. اختر المستودع (repo) الذي رفعته على GitHub.
3. إعدادات البناء (Build settings):
   - **Framework preset**: Vite
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. **قبل الضغط على Deploy**، افتح قسم **Environment variables (Advanced)** وأضف:
   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | رابط مشروعك في Supabase |
   | `VITE_SUPABASE_ANON_KEY` | مفتاح anon public |

   اختر أن تكون هذه المتغيرات مضافة لبيئتي **Production** و **Preview** معاً.
5. اضغط **Save and Deploy**.

> ملاحظة مهمة: هذه القيم تُحقن وقت البناء (build time) داخل ملفات JS النهائية لأن Vite
> يستخدمها كمتغيرات `import.meta.env`. هذا طبيعي وآمن هنا لأن مفتاح `anon` مصمم
> ليكون عاماً من جهة العميل (client-side) — الحماية الحقيقية للبيانات تأتي من
> سياسات RLS (Row Level Security) الموجودة في `0001_init.sql`، وهي التي تمنع أي شخص
> غير مسجّل دخول أو غير نشط من قراءة أو تعديل بياناتك، حتى لو رأى المفتاح.
> **لا تستخدم أبداً** مفتاح `service_role` في الواجهة الأمامية — هو فقط للاستخدام في السيرفر.

### ملاحظة أمنية

`VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY`/publishable key ليست مكاناً للأسرار الحقيقية؛ Vite يضمّن `VITE_*` في JavaScript النهائي. الأمان الحقيقي في Supabase Auth وRLS. لا تستخدم `service_role` أو `sb_secret_*` في المتصفح.

## 4) التطوير محلياً

```bash
npm install
cp .env.example .env.local   # ثم عدّل القيم داخل .env.local بقيمك الحقيقية
npm run dev
```

الملف `.env.local` موجود ضمن `.gitignore` تلقائياً ولن يُرفع إلى GitHub أبداً.

---

## 5) تثبيت التطبيق (PWA) على الأجهزة

بعد نشر الموقع، افتحه من متصفح Chrome أو Edge (على الكمبيوتر أو الأندرويد) وستظهر
أيقونة "تثبيت التطبيق" في شريط العنوان أو القائمة. على آيفون: من Safari اضغط زر
المشاركة → "إضافة إلى الشاشة الرئيسية". التطبيق يعمل بواجهة منفصلة تماماً لكل من
الجوال والتابلت وسطح المكتب (ثلاث واجهات منفصلة فعلياً، وليس مجرد تصغير للشاشة).

---

## 6) بنية المشروع

```
src/
  layouts/           MobileLayout, TabletLayout, DesktopLayout — كل واحدة منفصلة تماماً
  pages/             كل صفحة (المبيعات، المشتريات، الزبائن، الموردين، المخزون، الديون، المرتجعات، التقارير، النسخ الاحتياطي، الإعدادات)
  context/           إدارة تسجيل الدخول والصلاحيات
  lib/               اتصال Supabase، الأنواع (types)، تنسيق العملة IQD
supabase/migrations/ ملف SQL الكامل لإنشاء قاعدة البيانات دفعة واحدة
```

## 7) الأدوار والصلاحيات

| الدور | الصلاحية |
|---|---|
| owner | تحكم كامل بكل شيء |
| admin | تحكم كامل ما عدا حذف بعض الإعدادات الحساسة |
| accountant | إدارة كاملة للفواتير والمخزون والديون |
| cashier | تسجيل فواتير بيع وتسديد ديون فقط |
| viewer | مشاهدة فقط، بدون تعديل |

## 8) خارطة الطريق (الميزات القادمة)

هذا الإصدار يغطي الأساسيات الكاملة: مبيعات نقدي/دين، مشتريات، مرتجعات بيع وشراء،
مخزون بالكمية، ديون الزبائن والموردين مع تسديد جزئي أو كامل، مصاريف، تقارير أرباح،
نسخ احتياطي يدوي، أدوار مستخدمين، وواجهات منفصلة للجوال والتابلت وسطح المكتب.

الميزات التالية جاهزة الأساس في قاعدة البيانات (audit_log، notifications،
stock_movements، devices) وتحتاج فقط واجهة إضافية عند الطلب — أرسل لي أي طلب
جديد وسأضيفه دون تعقيد الباقي.


## Supabase migration order

The database uses ordered migrations:

1. `0001_init.sql` — legacy/base accounting schema.
2. `0002_hardening.sql` — stock and data-integrity hardening.
3. `0003_auth_profile_provisioning.sql` — Auth profile provisioning.
4. `0004_multitenant_saas.sql` — organization isolation, memberships, workspace switching and tenant RLS.
5. `0005_atomic_operations.sql` — atomic financial operations, stock adjustments, debt-payment validation and audit triggers.

If `0001` is already applied, **do not run it again**. Apply only the missing migrations in order. `0004` migrates existing data into a legacy organization; it does not intentionally delete business data.

## Cloudflare Pages

Build command:

```text
npm run build
```

Build output directory:

```text
dist
```

Required build-time environment variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

These values must be configured for the Cloudflare Pages environment that performs the production build, then a new deployment must be created. `VITE_*` values are embedded into the frontend during the Vite build.

If the variables are missing or malformed, the app intentionally shows a diagnostic screen instead of failing with a blank page.

## Cloudflare Pages deployment

This repository is a Vite/React application. Cloudflare Pages must build the source before publishing it.

Use these Git integration settings:

- Production branch: `main`
- Root directory: `/`
- Build command: `npm run build` (or `bash build.sh`)
- Build output directory: `dist`

`wrangler.jsonc` declares `dist` as the Pages output directory. The dashboard still needs a build command for Git-integrated Pages deployments.

For this application, publishing the repository root without running Vite is not a valid deployment: `index.html` references `/src/main.tsx`, which is source code and must be transformed by Vite into the files under `dist/`.

Required build environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Set them in Cloudflare Pages under the environment used by the production build, then create a new deployment.


## النشر الآلي من GitHub إلى Cloudflare

ملف GitHub Actions موجود في `.github/workflows/cloudflare-pages.yml`. تفاصيل إعداد الأسرار وCloudflare في `CLOUDFLARE-GITHUB.md`.


## Supabase migrations

Apply migrations in this order:
1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_hardening.sql`
3. `supabase/migrations/0003_auth_profile_provisioning.sql`

Migration 0003 is retained for compatibility. Migration 0004 supersedes its signup behavior: every new Auth user gets a private organization and `owner` membership automatically. Existing data is assigned to a legacy organization and protected by tenant RLS.


## Public SaaS model

ILYA is now designed as a multi-tenant application:

```text
Auth user
  └── organization_members
        └── organization
              ├── settings
              ├── customers / suppliers
              ├── products / stock
              ├── sales / purchases
              ├── returns / debts / expenses
              └── audit log
```

Every tenant-owned row has `organization_id`. RLS requires active membership in the current organization, while a database trigger prevents a browser from choosing a different tenant on insert/update.

The UI provides workspace switching, workspace creation, employee invitations and role management. Invitation tokens are random and stored only as SHA-256 hashes in the database.

Financial writes for sales, purchases, returns, debt payments, product creation and stock adjustments are executed through security-definer PostgreSQL functions so multi-step operations are atomic and cannot leave orphan invoice headers when an item/stock operation fails.

## Public client configuration

The project includes the Supabase URL and publishable browser key as a fallback in `src/lib/supabase.ts`. This is intentional: publishable keys are not secrets. Never place `service_role`, `sb_secret_*`, database passwords, or other privileged credentials in `VITE_*` variables or frontend code.


## v9 UI / performance hardening

- Fixed navigation to use stable fixed desktop/tablet rails and fixed mobile header/bottom navigation.
- Added responsive touch targets, safe-area spacing, text wrapping/truncation rules, and reduced-motion support.
- Added system/light/dark themes with separate `src/themes/light.css` and `src/themes/dark.css`, persisted preference, and OS theme change detection.
- Hardened collection rendering with `asArray()` so unexpected API response shapes cannot crash `.map()`/`.filter()` rendering.
- Added paginated backup export (bounded per-table) and validated backup format, store ownership, SHA-256 integrity, and hashed restore code.
- Restore is an explicit owner-only merge/upsert and intentionally does not delete current rows.
- Repaired migration 0004 legacy UNIQUE constraint handling; 0005 now fails with a clear migration-order error if 0004 has not completed.
