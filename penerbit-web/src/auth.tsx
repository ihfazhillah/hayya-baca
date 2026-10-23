import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getToken, login as apiLogin, setPenulisDipilih, setToken, setUnauthorizedHandler } from './api'

interface AuthState {
  token: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTok] = useState<string | null>(() => getToken())

  const logout = useCallback(() => {
    setToken(null)
    setPenulisDipilih(null)
    setTok(null)
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const t = await apiLogin(username.trim(), password)
    setToken(t)
    setTok(t)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => setTok(null))
    return () => setUnauthorizedHandler(null)
  }, [])

  const value = useMemo(() => ({ token, login, logout }), [token, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth di luar AuthProvider')
  return ctx
}
