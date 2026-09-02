import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const rawUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

function isValidSupabaseUrl(value: string | undefined): value is string {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname.endsWith('.supabase.co')
  } catch {
    return false
  }
}

export const isSupabaseConfigured = isValidSupabaseUrl(rawUrl) && Boolean(rawAnonKey)

export const supabaseConfigError = !isSupabaseConfigured
  ? 'إعدادات Supabase غير مكتملة. تأكد من VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY ثم أعد بناء ونشر المشروع.'
  : null

const missingConfigClient = new Proxy({} as SupabaseClient, {
  get() {
    throw new Error(supabaseConfigError ?? 'Supabase configuration is unavailable')
  },
})

export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(rawUrl, rawAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : missingConfigClient
