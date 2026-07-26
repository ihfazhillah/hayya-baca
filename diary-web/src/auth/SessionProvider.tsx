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

const GUARDIAN_AVATAR = '#6d28d9'

interface SessionContextValue {
  state: SessionState
  api: Endpoints
  signInChild: (username: string, password: string) => Promise<void>
  signInGuardian: (username: string, password: string) => Promise<void>
  completeSetup: (code: string, password: string) => Promise<void>
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
    ;(store as unknown as { onChange?: (s: SessionState) => void }).onChange =
      setState
    return () => store.destroy()
  }, [store])

  useEffect(() => {
    const handler = () => store.touch()
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, handler))
    return () =>
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, handler))
  }, [store])

  // Client bound to the live in-memory token, for authenticated calls.
  const api = useMemo(() => {
    const client = createApiClient({
      getToken: store.getToken,
      onUnauthorized: store.lock,
    })
    return createEndpoints(client)
  }, [store])

  const value = useMemo<SessionContextValue>(() => {
    // Fetch the canonical Me with a just-issued token, then commit the session.
    async function bootstrap(token: string, profile: QuickPick | null) {
      const client = createApiClient({
        getToken: () => token,
        onUnauthorized: store.lock,
      })
      const me = await createEndpoints(client).me()
      store.login(token, me, profile)
    }

    return {
      state,
      api,
      signInChild: async (username, password) => {
        const res = await api.childLogin(username, password)
        const profile: QuickPick = {
          username,
          name: res.child?.name ?? username,
          avatar_color: res.child?.avatar_color ?? GUARDIAN_AVATAR,
        }
        addQuickPick(profile)
        await bootstrap(res.token, profile)
      },
      signInGuardian: async (username, password) => {
        const res = await api.guardianLogin(username, password)
        // Guardians get a lock-screen profile but stay out of the quick-pick roster.
        await bootstrap(res.token, {
          username,
          name: username,
          avatar_color: GUARDIAN_AVATAR,
        })
      },
      completeSetup: async (code, password) => {
        const res = await api.childSetup(code, password)
        const profile: QuickPick | null = res.child
          ? {
              username: res.child.name,
              name: res.child.name,
              avatar_color: res.child.avatar_color,
            }
          : null
        if (profile) addQuickPick(profile)
        await bootstrap(res.token, profile)
      },
      logout: () => store.logout(),
      lock: () => store.lock(),
    }
  }, [state, api, store])

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
