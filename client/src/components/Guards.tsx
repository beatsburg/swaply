import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Spinner } from './ui'

/** Logged in users only. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { token, me, loading } = useAuth()
  const location = useLocation()

  if (!token) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (loading || !me) return <Spinner />
  return <>{children}</>
}

/** Recommendations, connections and chat need a complete profile first (TASK requirement). */
export function RequireCompleteProfile({ children }: { children: ReactNode }) {
  const { me } = useAuth()
  if (me && !me.is_completed) return <Navigate to="/profile" replace state={{ incomplete: true }} />
  return <>{children}</>
}

/** Login and register pages, send logged in users to the app. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { token } = useAuth()
  if (token) return <Navigate to="/" replace />
  return <>{children}</>
}
