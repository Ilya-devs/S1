import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/types'

interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function loadProfile(userId: string) {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (!mounted) return

      if (profileError) {
        setProfile(null)
        setError(`تعذر تحميل ملف المستخدم: ${profileError.message}`)
      } else if (!data) {
        setProfile(null)
        setError('الحساب موجود في Supabase Auth، لكن لا يوجد له سجل في جدول profiles.')
      } else if (!data.is_active) {
        setProfile(data as Profile)
        setError('هذا الحساب غير مفعّل. تواصل مع مدير النظام.')
      } else {
        setProfile(data as Profile)
        setError(null)
      }

      setLoading(false)
    }

    async function initialize() {
      if (!isSupabaseConfigured) {
        if (mounted) {
          setLoading(false)
          setError('إعدادات Supabase غير موجودة في نسخة الإنتاج. تأكد من VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في Cloudflare Pages ثم أعد النشر.')
        }
        return
      }

      const { data, error: sessionError } = await supabase.auth.getSession()
      if (!mounted) return

      if (sessionError) {
        setLoading(false)
        setError(`تعذر استعادة جلسة الدخول: ${sessionError.message}`)
        return
      }

      setSession(data.session)
      if (data.session) await loadProfile(data.session.user.id)
      else setLoading(false)
    }

    void initialize()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return
      setSession(newSession)

      if (newSession) {
        // Supabase holds an auth lock while invoking this callback. Defer the
        // profile query until the callback has returned to avoid auth deadlocks.
        setTimeout(() => {
          if (mounted) void loadProfile(newSession.user.id)
        }, 0)
      } else {
        setProfile(null)
        setError(null)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  async function signIn(email: string, password: string) {
    if (!isSupabaseConfigured) {
      return { error: 'إعدادات Supabase غير مكتملة. راجع إعدادات Cloudflare Pages.' }
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    return { error: signInError?.message ?? null }
  }

  async function signUp(email: string, password: string, fullName: string) {
    if (!isSupabaseConfigured) {
      return { error: 'إعدادات Supabase غير مكتملة. راجع إعدادات Cloudflare Pages.', needsEmailConfirmation: false }
    }

    const normalizedEmail = email.trim().toLowerCase()
    const trimmedName = fullName.trim()

    if (!normalizedEmail || !trimmedName) {
      return { error: 'أدخل الاسم والبريد الإلكتروني.', needsEmailConfirmation: false }
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: { data: { full_name: trimmedName } },
    })

    if (signUpError) {
      return { error: signUpError.message, needsEmailConfirmation: false }
    }

    return {
      error: null,
      needsEmailConfirmation: !data.session,
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, error, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
