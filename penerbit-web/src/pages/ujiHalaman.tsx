/** Bantuan uji halaman: router + Auth + Me, dengan fetch palsu dari src/test/fetch.ts. */
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from '../auth'
import { MeProvider } from '../me'

export const ME_ORTU = {
  peran: ['pemeriksa'], penulis: null, pemeriksa: [{ id: 1, nama: 'Fatih' }], bisa_diaktifkan: [], tamu: false,
}
export const ME_TAMU = { peran: ['tamu'], penulis: null, pemeriksa: [], bisa_diaktifkan: [], tamu: true }

function Lokasi() {
  const l = useLocation()
  return <output data-testid="lokasi">{l.pathname + l.search}</output>
}

export function tampilHalaman(path: string, rute: Record<string, ReactElement>) {
  localStorage.setItem('penerbit.token', 'uji')
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <MeProvider>
          <Routes>
            {Object.entries(rute).map(([p, el]) => <Route key={p} path={p} element={el} />)}
            <Route path="*" element={<p>lain</p>} />
          </Routes>
          <Lokasi />
        </MeProvider>
      </AuthProvider>
    </MemoryRouter>,
  )
}
