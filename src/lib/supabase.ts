import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.error(
    '[ILYA] متغيرات Supabase غير موجودة. تأكد من ضبط VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY كأسرار (Secrets) في Cloudflare Pages.'
  )
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})
