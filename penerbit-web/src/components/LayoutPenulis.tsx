import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { getBeranda } from '../api'
import type { Beranda } from '../types'
import { NavPenulis } from './Nav'

interface NavData {
  peta: Beranda['peta']
  poin: number | undefined
  /** Panggil setelah misi selesai / hadiah baru supaya titik modul dan poin ikut berubah. */
  segarkan: () => void
}

const NavContext = createContext<NavData>({ peta: [], poin: undefined, segarkan: () => {} })

export function useNavPenulis() {
  return useContext(NavContext)
}

/** Area Penulis: nav bersama (titik modul + poin) di atas setiap halaman. */
export default function LayoutPenulis() {
  const [data, setData] = useState<{ peta: Beranda['peta']; poin: number | undefined }>({ peta: [], poin: undefined })
  const segarkan = useCallback(() => {
    getBeranda().then((b) => setData({ peta: b.peta, poin: b.poin })).catch(() => {})
  }, [])
  useEffect(segarkan, [segarkan])
  return (
    <NavContext.Provider value={{ ...data, segarkan }}>
      <NavPenulis titik={data.peta} poin={data.poin} />
      <Outlet />
    </NavContext.Provider>
  )
}
