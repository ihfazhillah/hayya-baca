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
  getStoredName,
  getToken,
  loginCode as apiLoginCode,
  loginPassword as apiLoginPassword,
  setStoredName,
  setToken,
  setUnauthorizedHandler,
} from './api'

interface AuthState {
  token: string | null
  name: string | null
  loginWithPassword: (username: string, password: string) => Promise<void>
  loginWithCode: (code: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTok] = useState<string | null>(() => getToken())
  const [name, setName] = useState<string | null>(() => getStoredName())

  const logout = useCallback(() => {
    setToken(null)
    setStoredName(null)
    setTok(null)
    setName(null)
  }, [])

  const loginWithPassword = useCallback(
    async (username: string, password: string) => {
      const t = await apiLoginPassword(username.trim(), password)
      setToken(t)
      setStoredName(username.trim())
      setTok(t)
      setName(username.trim())
    },
    [],
  )

  const loginWithCode = useCallback(async (code: string) => {
    const res = await apiLoginCode(code.trim())
    setToken(res.token)
    setStoredName(res.name)
    setTok(res.token)
    setName(res.name)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(logout)
    return () => setUnauthorizedHandler(null)
  }, [logout])

  const value = useMemo(
    () => ({ token, name, loginWithPassword, loginWithCode, logout }),
    [token, name, loginWithPassword, loginWithCode, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
