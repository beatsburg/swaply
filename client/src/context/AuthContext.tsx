import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getToken, setToken, setUnauthorizedHandler } from '../api/client'
import type { Me } from '../api/types'
import { authApi, meApi } from '../api/users'

type AuthContextValue = {
  token: string | null
  me: Me | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
  /** Reload /me, e.g. after the profile was saved and is_completed may have changed */
  refreshMe: () => Promise<Me | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => getToken())
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState<boolean>(() => Boolean(getToken()))

  const clearSession = useCallback(() => {
    setToken(null)
    setTokenState(null)
    setMe(null)
  }, [])

  const refreshMe = useCallback(async () => {
    try {
      const data = await meApi.get()
      setMe(data)
      return data
    } catch {
      return null
    }
  }, [])

  // Load the user when the app starts with a saved token
  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    meApi
      .get()
      .then((data) => {
        if (!cancelled) setMe(data)
      })
      .catch(() => {
        if (!cancelled) clearSession()
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, clearSession])

  // Any 401 from the API (expired token) logs out
  useEffect(() => {
    setUnauthorizedHandler(clearSession)
    return () => setUnauthorizedHandler(null)
  }, [clearSession])

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password)
    setToken(res.token)
    setTokenState(res.token)
  }, [])

  const register = useCallback(async (name: string, email: string, password: string) => {
    const res = await authApi.register(name, email, password)
    setToken(res.token)
    setTokenState(res.token)
  }, [])

  const logout = useCallback(() => {
    authApi.logout().catch(() => {}) // JWT is stateless, dropping it on our side is what matters
    clearSession()
  }, [clearSession])

  const value = useMemo(
    () => ({ token, me, loading, login, register, logout, refreshMe }),
    [token, me, loading, login, register, logout, refreshMe],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
