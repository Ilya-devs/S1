# GitHub + Cloudflare Pages

ILYA uses the repository connection already configured in Cloudflare Pages.

## GitHub Actions

The workflow at `.github/workflows/cloudflare-pages.yml` is **verification only**.

It:
1. checks out `main`;
2. installs exact lockfile dependencies with `npm ci`;
3. supplies only the two Supabase build variables;
4. deletes `dist`;
5. runs `npm run build`;
6. verifies `dist/index.html`.

It does **not** upload to Cloudflare and does not require any Cloudflare token.

### GitHub Secrets

Only:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Cloudflare Pages

Cloudflare is connected directly to `Ilya-devs/S1`.

Use:

- Production branch: `main`
- Root directory: `/`
- Build command: `npm run build`
- Build output directory: `dist`

Cloudflare must also have these two variables under the **Production build environment**:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

They are build-time client configuration. Never put a Supabase secret/service-role key in either variable.

## Deployment flow

```text
push main
   │
   ├── GitHub Actions → build verification
   │
   └── Cloudflare Git Integration
          ├── install
          ├── build
          └── deploy dist
```

Do not configure a second Wrangler/Direct Upload deployment path. Keeping one production deployer avoids duplicate deployments and version confusion.

Cloudflare may retain historical deployment records for audit/rollback; this does not mean the old deployment is serving production.

## Recovery from a failed build

If Cloudflare says:

```text
No build command specified
```

set the dashboard Build command to:

```text
npm run build
```

If it says:

```text
Output directory "dist" not found
```

the build did not run or failed before producing `dist`.

If the build reports missing `VITE_*` variables, check the **Production** variables in Cloudflare and create a new deployment after saving them.
