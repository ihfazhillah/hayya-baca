import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { getMe, getPenulisDipilih, setPenulisDipilih, setSimulasi } from './api'
import type { Me } from './types'

interface MeState {
  me: Me | null
  error: string | null
  muatUlang: () => Promise<void>
  /** Penulis yang sedang dilihat Pemeriksa. */
  penulisDipilih: number | null
  pilihPenulis: (id: number) => void
  /** Masuk/keluar mode "Lihat sebagai anak". */
  gantiSimulasi: (aktif: boolean) => Promise<void>
}

const MeContext = createContext<MeState | null>(null)

export function MeProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [penulisDipilih, setDipilih] = useState<number | null>(() => getPenulisDipilih())

  const muatUlang = useCallback(async () => {
    try {
      const m = await getMe()
      setMe(m)
      setError(null)
      const ada = m.pemeriksa.map((p) => p.id)
      if (ada.length && !ada.includes(getPenulisDipilih() ?? -1)) {
        setPenulisDipilih(ada[0])
        setDipilih(ada[0])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  useEffect(() => {
    void muatUlang()
  }, [muatUlang])

  const pilihPenulis = useCallback((id: number) => {
    setPenulisDipilih(id)
    setDipilih(id)
  }, [])

  const gantiSimulasi = useCallback(async (aktif: boolean) => {
    setSimulasi(aktif)
    setMe(null)
    await muatUlang()
  }, [muatUlang])

  return (
    <MeContext.Provider value={{ me, error, muatUlang, penulisDipilih, pilihPenulis, gantiSimulasi }}>
      {children}
    </MeContext.Provider>
  )
}

export function useMe() {
  const ctx = useContext(MeContext)
  if (!ctx) throw new Error('useMe di luar MeProvider')
  return ctx
}

/** Halaman pertama setelah login, sesuai peran. */
export function rumahUntuk(me: Me): string {
  if (me.peran.includes('penulis')) return '/'
  if (me.peran.includes('pemeriksa') || me.bisa_diaktifkan.length) return '/ortu'
  if (me.peran.includes('tamu')) return '/ulasan'
  return '/tanpa-peran'
}
