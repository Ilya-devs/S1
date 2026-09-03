# GitHub → Cloudflare Pages

این پروژه برای استقرار Production از شاخه `main` توسط GitHub Actions آماده شده است.

## GitHub Secrets المطلوبة

من مستودع GitHub:

**Settings → Secrets and variables → Actions → New repository secret**

أضف:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- ~~`CLOUDFLARE_API_TOKEN`~~
- ~~`CLOUDFLARE_ACCOUNT_ID`~~

يجب أن يكون ~~`CLOUDFLARE_API_TOKEN`~~ مخصصاً للحساب ويملك صلاحية **Pages Write**.

> لا تضع `service_role` الخاص بـ Supabase في GitHub Secrets الخاصة بالواجهة الأمامية أو داخل الكود.

## طريقة العمل

عند كل `push` إلى `main`:

1. GitHub يسحب آخر commit فقط.
2. يستخدم Node `22.16.0`.
3. ينفذ `npm ci` من `package-lock.json`.
4. يحذف `dist` القديم.
5. ينفذ `npm run build`.
6. يتأكد من وجود `dist/index.html`.
7. يرفع **dist فقط** إلى مشروع Cloudflare Pages `s1`.
8. يرسل SHA الخاص بالـ commit إلى Cloudflare.

لا يتم رفع `node_modules` أو ملفات المصدر كملفات الموقع النهائي، ولا يتم إنشاء GitHub artifact قديم.

## مهم جداً في Cloudflare

هذه الطريقة تستخدم **GitHub Actions + Wrangler Direct Upload** كمسار النشر.

لمنع نشرين متوازيين أو نسخ Preview غير مرغوبة:

- عطّل **Automatic deployments** من Cloudflare Pages إذا كان المشروع مربوطاً بـ GitHub Cloudflare Integration.
- اترك GitHub Actions هو المسؤول عن Production.
- Production branch = `main`.
- لا تنفذ `wrangler pages deploy` من جهاز آخر أثناء النشر الآلي.

Cloudflare يحتفظ بسجل deployments في لوحة التحكم لأغراض التتبع والرجوع، وهذا مختلف عن أن تكون النسخة القديمة هي النسخة التي يخدمها الدومين. الـ Production deployment الذي ينشره هذا الـ workflow يكون على `main`.

## تشغيل يدوي

من GitHub:

**Actions → Build and Deploy to Cloudflare Pages → Run workflow**

ويمكن أيضاً تشغيله تلقائياً بمجرد:

```bash
git push origin main
```


## ملاحظة عن Cloudflare المتصل بالمستودع

هذا المشروع لا يحتاج `CLOUDFLARE_API_TOKEN` أو `CLOUDFLARE_ACCOUNT_ID` في GitHub Actions. النشر إلى Cloudflare Pages يتم تلقائياً من اتصال Cloudflare بالمستودع. GitHub Actions هنا يبني نسخة Production ويتحقق منها فقط، ويحتاج فقط أسرار Supabase:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

ويجب أن تكون قيم Supabase نفسها موجودة أيضاً في Environment Variables الخاصة بـ Cloudflare Pages، لأن Cloudflare ينفذ build خاصاً به عند وصول push إلى `main`.
