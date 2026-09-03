import { createClient } from '@supabase/supabase-js'

// Supabase's publishable client configuration is intentionally available to the
// browser. It is NOT a secret. Database security must come from Supabase Auth,
// grants, and Row Level Security (RLS), never from hiding this value.
//
// Cloudflare Pages can still override these values at build time with VITE_*.
// The built-in values are a deployment-safe fallback so a missing Cloudflare
// environment variable cannot disable the public application.
const DEFAULT_SUPABASE_URL = 'https://rqoaccxbopofyqmzgzhh.supabase.co'
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_j1fYd-EFC0yfn6t_w8tYhA_GLeIfp3V'

const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfig = {
  url: envUrl?.trim() || DEFAULT_SUPABASE_URL,
  anonKey: envKey?.trim() || DEFAULT_SUPABASE_PUBLISHABLE_KEY,
  source: envUrl?.trim() && envKey?.trim() ? 'environment' : 'built-in-public-config',
} as const

export const isSupabaseConfigured =
  /^https:\/\/[^\s/]+\.supabase\.co(?:\/.*)?$/i.test(supabaseConfig.url) &&
  supabaseConfig.anonKey.startsWith('sb_publishable_')

// The publishable key is safe to ship in a browser when RLS is correctly
// configured. Never replace this with a Supabase secret/service-role key.
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
