import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { AuthProvider } from './auth'
import { getToken } from './api'
import { pasangFetch } from './test/fetch'

const ME_PENULIS = { peran: ['penulis'], penulis: { id: 1, nama: 'Fatih' }, pemeriksa: [], bisa_diaktifkan: [], tamu: false }
const ME_ORTU = { peran: ['pemeriksa'], penulis: null, pemeriksa: [{ id: 1, nama: 'Fatih' }], bisa_diaktifkan: [], tamu: false }

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

  it('penulis yang membuka /ortu dikembalikan ke Beranda', async () => {
    localStorage.setItem('penerbit.token', 'anak')
    pasangFetch({ 'GET /api/penerbit/me/': { body: ME_PENULIS } })
    tampil('/ortu')
    expect(await screen.findByRole('heading', { name: 'Beranda' })).toBeInTheDocument()
  })
})
