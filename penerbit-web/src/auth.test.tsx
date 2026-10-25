import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { AuthProvider } from './auth'
import { getToken } from './api'
import { pasangFetch } from './test/fetch'

const ME_PENULIS = { peran: ['penulis'], penulis: { id: 1, nama: 'Fatih' }, pemeriksa: [], bisa_diaktifkan: [], tamu: false }
const ME_ORTU = { peran: ['pemeriksa'], penulis: null, pemeriksa: [{ id: 1, nama: 'Fatih' }], bisa_diaktifkan: [], tamu: false, bisa_simulasi: true, sedang_simulasi: false }
const ME_SIM = { peran: ['penulis'], penulis: { id: 9, nama: 'Simulasi' }, pemeriksa: [], bisa_diaktifkan: [], tamu: false, bisa_simulasi: true, sedang_simulasi: true }

function tampil(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  )
}

async function isiMasuk() {
  const u = userEvent.setup()
  await u.type(screen.getByLabelText('Nama pengguna'), 'fatih')
  await u.type(screen.getByLabelText('Kata sandi'), 'rahasia')
  await u.click(screen.getByRole('button', { name: 'Masuk' }))
}

describe('Masuk', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('anak masuk lewat child-login lalu mendarat di Beranda', async () => {
    const calls = pasangFetch({
      'POST /api/auth/child-login/': { body: { token: 'anak' } },
      'GET /api/penerbit/me/': { body: ME_PENULIS },
    })
    tampil()
    await isiMasuk()
    expect(await screen.findByRole('heading', { name: 'Beranda' })).toBeInTheDocument()
    expect(getToken()).toBe('anak')
    expect(calls.some((c) => c.url === '/api/auth/login/')).toBe(false)
    // Nav dan halaman Beranda sama-sama butuh data Beranda: cukup satu permintaan.
    await new Promise((r) => setTimeout(r, 50))
    expect(calls.filter((c) => c.method === 'GET' && c.url === '/api/penerbit/beranda/')).toHaveLength(1)
  })

  it('akun orang tua ditolak child-login lalu masuk lewat login biasa ke /ortu', async () => {
    pasangFetch({
      'POST /api/auth/child-login/': { status: 403, body: { detail: 'Akun ini bukan akun anak' } },
      'POST /api/auth/login/': { body: { token: 'ayah' } },
      'GET /api/penerbit/me/': { body: ME_ORTU },
    })
    tampil()
    await isiMasuk()
    expect(await screen.findByRole('heading', { name: 'Dasbor' })).toBeInTheDocument()
    expect(getToken()).toBe('ayah')
  })

  it('kata sandi salah memberi pesan ramah', async () => {
    pasangFetch({ 'POST /api/auth/child-login/': { status: 401, body: { detail: 'salah' } } })
    tampil()
    await isiMasuk()
    expect(await screen.findByRole('alert')).toHaveTextContent('minta bantuan Ayah')
  })

  it('anak bisa keluar dari Beranda lalu kembali ke halaman Masuk', async () => {
    localStorage.setItem('penerbit.token', 'anak')
    pasangFetch({ 'GET /api/penerbit/me/': { body: ME_PENULIS } })
    tampil()
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Keluar' }))
    expect(await screen.findByLabelText('Nama pengguna')).toBeInTheDocument()
    expect(getToken()).toBeNull()
  })

  it('penulis yang membuka /ortu dikembalikan ke Beranda', async () => {
    localStorage.setItem('penerbit.token', 'anak')
    pasangFetch({ 'GET /api/penerbit/me/': { body: ME_PENULIS } })
    tampil('/ortu')
    expect(await screen.findByRole('heading', { name: 'Beranda' })).toBeInTheDocument()
  })

  it('orang tua bisa "Lihat sebagai anak" lalu kembali ke Pojok Orang Tua', async () => {
    localStorage.setItem('penerbit.token', 'ayah')
    pasangFetch({
      'GET /api/penerbit/me/': (_url, init) => {
        const h = init.headers as Record<string, string>
        return { body: h['X-Penerbit-Sebagai'] === 'simulasi' ? ME_SIM : ME_ORTU }
      },
    })
    tampil('/ortu')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Lihat sebagai anak' }))
    expect(await screen.findByRole('heading', { name: 'Beranda' })).toBeInTheDocument()
    expect(screen.getByText(/Mode simulasi/)).toBeInTheDocument()
    // Saat simulasi, keluar lewat banner — bukan logout akun orang tua.
    expect(screen.queryByRole('button', { name: 'Keluar' })).not.toBeInTheDocument()
    expect(localStorage.getItem('penerbit.simulasi')).toBe('1')
    await u.click(screen.getByRole('button', { name: 'Kembali ke Pojok Orang Tua' }))
    expect(await screen.findByRole('heading', { name: 'Dasbor' })).toBeInTheDocument()
    expect(localStorage.getItem('penerbit.simulasi')).toBeNull()
  })
})
