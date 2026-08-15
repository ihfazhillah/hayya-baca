import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { getMe } from './api'
import type { Me } from './types'

interface MeState {
  me: Me | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const MeContext = createContext<MeState | null>(null)

export function MeProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    // Stable (no deps) so the initial effect never re-fires. Updates `me` in
    // place; later refreshes keep the current screen + its local state (e.g.
    // the active Kelola tab) instead of blanking to a spinner.
    try {
      const data = await getMe()
      setMe(data)
      setError(null)
    } catch (e) {
      // On a background failure keep whatever we already show; only surface an
      // error when there is nothing on screen yet (first load).
      setMe((cur) => {
        if (cur === null)
          setError(e instanceof Error ? e.message : 'Gagal memuat')
        return cur
      })
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    void refresh().finally(() => setLoading(false))
  }, [refresh])

  return (
    <MeContext.Provider value={{ me, loading, error, refresh }}>
      {children}
    </MeContext.Provider>
  )
}

export function useMe(): MeState {
  const ctx = useContext(MeContext)
  if (!ctx) throw new Error('useMe must be used within MeProvider')
  return ctx
}
