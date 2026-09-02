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

## 3) النشر على Cloudflare Pages وإضافة الأسرار (Secrets)

هذه هي الطريقة الصحيحة لإضافة رابط ومفتاح Supabase **كأسرار** بدل كتابتها داخل الكود:

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

### الطريقة ب — عبر سطر الأوامر (Wrangler CLI)

```bash
npm install -g wrangler
wrangler login

# إضافة الأسرار لمشروع Pages موجود مسبقاً
wrangler pages secret put VITE_SUPABASE_URL --project-name=ilya-accounting
wrangler pages secret put VITE_SUPABASE_ANON_KEY --project-name=ilya-accounting
```

سيطلب منك إدخال القيمة في الطرفية (Terminal) مباشرة، ولن تظهر في أي مكان مكتوب بالكود.

### النشر اليدوي (بدون ربط Git) — بديل سريع

```bash
npm run build
npx wrangler pages deploy dist --project-name=ilya-accounting
```

---

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

The database in this repository uses ordered migrations:

1. `supabase/migrations/0001_init.sql` — initial schema.
2. `supabase/migrations/0002_hardening.sql` — security/data-integrity hardening for an existing `0001` database.

If `0001_init.sql` was already applied, **do not run it again**. Run only `0002_hardening.sql`.

`0002_hardening.sql` uses idempotent policy/constraint handling and does not drop business data.

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
