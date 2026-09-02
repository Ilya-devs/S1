import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { StartupScreen } from '@/components/StartupScreen'

export function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: string[] }) {
  const { session, profile, loading, error } = useAuth()

  if (loading) {
    return (
      <div className="flex h-[100dvh] w-screen items-center justify-center bg-ink-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brass-500 border-t-transparent" />
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  if (error || !profile) {
    return (
      <StartupScreen
        title="تعذر تجهيز حسابك"
        message={error ?? 'لم يتم العثور على ملف المستخدم.'}
        action="تأكد من وجود سجل مطابق لمعرّف المستخدم في جدول profiles وأن is_active = true. لا تنشئ بيانات عشوائية؛ استخدم معرف المستخدم الحقيقي من Supabase Auth."
      />
    )
  }

  if (roles && !roles.includes(profile.role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
