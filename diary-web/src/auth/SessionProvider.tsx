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
import type { Me, MeChild, MeGuardian } from '@/api/types'
import { SessionStore, type SessionState } from './sessionStore'

interface SessionContextValue {
  state: SessionState
  me: Me | null // the active profile's Me (null in lobby / unlock)
  api: Endpoints
  unlock: (username: string, password: string) => Promise<void>
  enterChild: (username: string, password: string) => Promise<void>
  enterGuardian: (password: string) => Promise<void>
  completeSetup: (code: string, password: string) => Promise<void>
  switchProfile: () => void
  logout: () => void
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

  // Client bound to the active profile's token; a 401 drops back to the lobby.
  const api = useMemo(
    () =>
      createEndpoints(
        createApiClient({ getToken: store.getToken, onUnauthorized: store.lock }),
      ),
    [store],
  )

  // Unauthenticated client for login/setup — a 401 here means "wrong password",
  // not an expired session, so it must never trigger the lock.
  const authApi = useMemo(
    () =>
      createEndpoints(
        createApiClient({ getToken: () => null, onUnauthorized: () => {} }),
      ),
    [],
  )

  const value = useMemo<SessionContextValue>(() => {
    // Fetch the canonical Me with a just-issued token.
    async function fetchMe(token: string): Promise<Me> {
      const client = createApiClient({
        getToken: () => token,
        onUnauthorized: store.lock,
      })
      return createEndpoints(client).me()
    }

    return {
      state,
      me: state.active?.me ?? null,
      api,
      // Guardian authenticates → cache the family, land on the lobby.
      unlock: async (username, password) => {
        const res = await authApi.guardianLogin(username, password)
        const me = await fetchMe(res.token)
        if (me.role !== 'guardian') throw new Error('Akun ini bukan orang tua')
        store.unlock(username.trim().toLowerCase(), me as MeGuardian)
      },
      // Enter a child profile with its own password.
      enterChild: async (username, password) => {
        const res = await authApi.childLogin(username, password)
        const me = await fetchMe(res.token)
        if (me.role !== 'child') throw new Error('Akun ini bukan anak')
        store.enterChild(me as MeChild, res.token)
      },
      // Re-auth to enter guardian mode (username from the family cache).
      enterGuardian: async (password) => {
        const username = state.family?.guardianUsername
        if (!username) throw new Error('Belum membuka kunci keluarga')
        const res = await authApi.guardianLogin(username, password)
        const me = await fetchMe(res.token)
        if (me.role !== 'guardian') throw new Error('Akun ini bukan orang tua')
        store.enterGuardian(me as MeGuardian, res.token)
      },
      // Child sets a password via a one-time code → enters their profile.
      completeSetup: async (code, password) => {
        const res = await authApi.childSetup(code, password)
        const me = await fetchMe(res.token)
        if (me.role !== 'child') throw new Error('Akun ini bukan anak')
        store.enterChild(me as MeChild, res.token)
      },
      switchProfile: () => store.switchProfile(),
      logout: () => store.logout(),
    }
  }, [state, api, authApi, store])

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
