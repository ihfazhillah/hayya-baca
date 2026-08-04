import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  getStoredUsername,
  getToken,
  loginRequest,
  setStoredUsername,
  setToken,
  setUnauthorizedHandler,
} from './api'

interface AuthState {
  token: string | null
  username: string | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTok] = useState<string | null>(() => getToken())
  const [username, setName] = useState<string | null>(() => getStoredUsername())

  const logout = useCallback(() => {
    setToken(null)
    setStoredUsername(null)
    setTok(null)
    setName(null)
  }, [])

  const login = useCallback(async (u: string, p: string) => {
    const t = await loginRequest(u.trim(), p)
    setToken(t)
    setStoredUsername(u.trim())
    setTok(t)
    setName(u.trim())
  }, [])

  // A 401 from any request drops us back to the login screen.
  useEffect(() => {
    setUnauthorizedHandler(logout)
    return () => setUnauthorizedHandler(null)
  }, [logout])

  const value = useMemo(
    () => ({ token, username, login, logout }),
    [token, username, login, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
