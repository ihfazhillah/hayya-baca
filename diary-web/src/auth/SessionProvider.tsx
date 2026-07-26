import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createApiClient } from '@/api/client'
import { createEndpoints, type Endpoints } from '@/api/endpoints'
import { SessionStore, type SessionState } from './sessionStore'
import { addQuickPick, type QuickPick } from './quickpick'
import type { Me } from '@/api/types'

interface SessionContextValue {
  state: SessionState
  api: Endpoints
  login: (token: string, me: Me, profile?: QuickPick | null) => void
  logout: () => void
  lock: () => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll']

export function SessionProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<SessionStore | null>(null)
  if (storeRef.current === null) {
    storeRef.current = new SessionStore()
  }
  const store = storeRef.current

  const [state, setState] = useState<SessionState>(store.state)

  useEffect(() => {
    // Bridge store → React. onChange is set here so it survives StrictMode.
    ;(store as unknown as { onChange?: (s: SessionState) => void }).onChange =
      setState
    return () => store.destroy()
  }, [store])

  // Reset the idle timer on any user activity.
  useEffect(() => {
    const handler = () => store.touch()
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, handler))
    return () =>
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, handler))
  }, [store])

  const api = useMemo(() => {
    const client = createApiClient({
      getToken: store.getToken,
      onUnauthorized: store.lock,
    })
    return createEndpoints(client)
  }, [store])

  const value = useMemo<SessionContextValue>(
    () => ({
      state,
      api,
      login: (token, me, profile) => {
        if (profile) addQuickPick(profile)
        store.login(token, me, profile ?? null)
      },
      logout: () => store.logout(),
      lock: () => store.lock(),
    }),
    [state, api, store],
  )

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  )
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (ctx === null) {
    throw new Error('useSession must be used within SessionProvider')
  }
  return ctx
}
