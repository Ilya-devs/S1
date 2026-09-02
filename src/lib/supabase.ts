import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfig = {
  url: url?.trim() ?? '',
  anonKey: anonKey?.trim() ?? '',
}

export const isSupabaseConfigured =
  /^https:\/\/[^\s/]+\.supabase\.co(?:\/.*)?$/i.test(supabaseConfig.url) &&
  supabaseConfig.anonKey.length > 0

// Keep module evaluation safe when Cloudflare has not injected Vite variables.
// App renders a diagnostic screen instead of crashing before React mounts.
export const supabase = createClient(
  isSupabaseConfigured ? supabaseConfig.url : 'https://invalid.supabase.co',
  isSupabaseConfigured ? supabaseConfig.anonKey : 'invalid-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
