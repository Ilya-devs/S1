import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '@/lib/supabase'
import type { Organization, OrganizationMembership, Profile } from '@/lib/types'
import { asArray } from '@/lib/collections'

interface AuthState {
  session: Session | null
  profile: Profile | null
  organizations: Organization[]
  loading: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>
  switchOrganization: (organizationId: string) => Promise<{ error: string | null }>
  createOrganization: (name: string) => Promise<{ error: string | null; organization: Organization | null }>
  acceptInvitation: (token: string) => Promise<{ error: string | null }>
  resetPassword: (email: string) => Promise<{ error: string | null }>
  updatePassword: (password: string) => Promise<{ error: string | null }>
  resendConfirmation: (email: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadOrganizations(userId?: string) {
    const { data: memberships, error: membershipsError } = await supabase
      .from('organization_members')
      .select('organization_id, user_id, role, is_active, joined_at, updated_at')
      .eq('user_id', userId ?? session?.user.id ?? '')
      .eq('is_active', true)

    if (membershipsError) throw membershipsError
    const ids = asArray(memberships).map((m) => m.organization_id)
    if (ids.length === 0) {
      setOrganizations([])
      return
    }

    const { data, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .in('id', ids)
      .eq('is_active', true)
      .order('created_at')

    if (orgError) throw orgError
    setOrganizations(asArray<Organization>(data))
  }

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
        setError('الحساب موجود في Supabase Auth، لكن لا يوجد له سجل في profiles. طبّق آخر migration.')
      } else if (!data.is_active) {
        setProfile(data as Profile)
        setError('هذا الحساب غير مفعّل. تواصل مع مدير المتجر.')
      } else if (!data.active_organization_id) {
        setProfile(data as Profile)
        setError('الحساب لا يملك متجراً نشطاً. أنشئ متجراً أو طبّق Migration 0004.')
      } else {
        let normalizedProfile = data as Profile
        const { data: membership, error: membershipError } = await supabase
          .from('organization_members')
          .select('role, is_active')
          .eq('organization_id', data.active_organization_id)
          .eq('user_id', userId)
          .maybeSingle()

        if (membershipError || !membership?.is_active) {
          setProfile(null)
          setError('تعذر التحقق من عضويتك في المتجر النشط.')
        } else {
          normalizedProfile = { ...normalizedProfile, role: membership.role }
          setProfile(normalizedProfile)
          setError(null)
          try {
            await loadOrganizations(userId)
          } catch (e) {
            if (mounted) setError(`تعذر تحميل المتاجر: ${e instanceof Error ? e.message : 'خطأ غير معروف'}`)
          }
        }
      }

      setLoading(false)
    }

    async function initialize() {
      if (!isSupabaseConfigured) {
        if (mounted) {
          setLoading(false)
          setError('تعذر تهيئة اتصال Supabase. تحقق من إعدادات المشروع.')
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
        setTimeout(() => {
          if (mounted) void loadProfile(newSession.user.id)
        }, 0)
      } else {
        setProfile(null)
        setOrganizations([])
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
    if (!isSupabaseConfigured) return { error: 'إعدادات اتصال Supabase غير متاحة.' }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    return { error: signInError?.message ?? null }
  }

  async function signUp(email: string, password: string, fullName: string) {
    if (!isSupabaseConfigured) return { error: 'إعدادات اتصال Supabase غير متاحة.', needsEmailConfirmation: false }

    const normalizedEmail = email.trim().toLowerCase()
    const trimmedName = fullName.trim()
    if (!normalizedEmail || !trimmedName) return { error: 'أدخل الاسم والبريد الإلكتروني.', needsEmailConfirmation: false }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: { data: { full_name: trimmedName } },
    })

    if (signUpError) return { error: signUpError.message, needsEmailConfirmation: false }

    return { error: null, needsEmailConfirmation: !data.session }
  }

  async function switchOrganization(organizationId: string) {
    const { data, error: rpcError } = await supabase.rpc('switch_organization', { target_org: organizationId })
    if (rpcError) return { error: rpcError.message }

    setProfile(data as Profile)
    try {
      await loadOrganizations(data?.id)
      // Query keys are intentionally simple across legacy pages; reload after
      // a workspace switch guarantees no in-memory cache from the previous
      // tenant can be rendered even briefly.
      window.location.reload()
      return { error: null }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'تعذر تحديث قائمة المتاجر' }
    }
  }

  async function createOrganization(name: string) {
    const { data, error: rpcError } = await supabase.rpc('create_organization', { org_name: name.trim() })
    if (rpcError) return { error: rpcError.message, organization: null }

    const org = data as Organization
    const switched = await switchOrganization(org.id)
    if (switched.error) return { error: switched.error, organization: null }
    return { error: null, organization: org }
  }

  async function resetPassword(email: string) {
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error: resetError?.message ?? null }
  }

  async function resendConfirmation(email: string) {
    const { error: resendError } = await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase() })
    return { error: resendError?.message ?? null }
  }

  async function updatePassword(password: string) {
    if (password.length < 8) return { error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.' }
    const { error: updateError } = await supabase.auth.updateUser({ password })
    return { error: updateError?.message ?? null }
  }

  async function acceptInvitation(token: string) {
    const { data, error: rpcError } = await supabase.rpc('accept_organization_invitation', { invite_token: token })
    if (rpcError) return { error: rpcError.message }
    const member = data as OrganizationMembership
    setProfile((current) => current ? { ...current, active_organization_id: member.organization_id, role: member.role } : current)
    try {
      const userId = session?.user.id ?? (await supabase.auth.getUser()).data.user?.id
      await loadOrganizations(userId)
      return { error: null }
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'تمت الدعوة لكن تعذر تحديث المتاجر' }
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{ session, profile, organizations, loading, error, signIn, signUp, switchOrganization, createOrganization, acceptInvitation, resetPassword, updatePassword, resendConfirmation, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
