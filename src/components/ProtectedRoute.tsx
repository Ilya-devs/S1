import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

interface ProtectedRouteProps {
  children: ReactNode
  roles?: readonly string[]
}

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { session, profile, loading, configError } = useAuth()

  if (loading) {
    return (
      <div className="flex h-[100dvh] w-screen items-center justify-center bg-ink-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brass-500 border-t-transparent" />
      </div>
    )
  }

  if (configError) return <Navigate to="/login" replace />
  if (!session) return <Navigate to="/login" replace />
  if (!profile || profile.is_active === false) return <Navigate to="/login?reason=profile" replace />
  if (roles && !roles.includes(profile.role)) return <Navigate to="/" replace />

  return <>{children}</>
}
