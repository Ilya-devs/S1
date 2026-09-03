import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const required = [
  'index.html',
  'package.json',
  'package-lock.json',
  'vite.config.ts',
  'supabase/migrations/0001_init.sql',
  'supabase/migrations/0002_hardening.sql',
  'supabase/migrations/0003_auth_profile_provisioning.sql',
  'supabase/migrations/0004_multitenant_saas.sql',
  'supabase/migrations/0005_atomic_operations.sql',
]
for (const file of required) {
  if (!existsSync(join(root, file))) throw new Error(`Missing required file: ${file}`)
}
if (!existsSync(join(root, 'dist/index.html'))) throw new Error('dist/index.html was not generated')

const src = readFileSync(join(root, 'src/lib/supabase.ts'), 'utf8')
if (/sb_secret_|service_role/i.test(src)) throw new Error('Privileged Supabase credential detected in frontend configuration')

const app = readFileSync(join(root, 'src/App.tsx'), 'utf8')
for (const route of ['/login', '/register', '/forgot-password', '/reset-password']) {
  if (!app.includes(route)) throw new Error(`Missing auth route: ${route}`)
}

console.log('ILYA production verification: OK')
