import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { pasangFetch } from '../../test/fetch'
import { P, naskah } from '../../editor/fixtur'
import NaskahBaru from './NaskahBaru'

const IDE = [{ id: 9, teks: 'Listrik padam saat hujan', sumur: 'bagaimana', bintang: [true, true, true], tanggal: '' }]

function tampil() {
  return render(
    <MemoryRouter initialEntries={['/naskah/baru']}>
      <Routes>
        <Route path="/naskah/baru" element={<NaskahBaru />} />
        <Route path="/naskah/:id/draf-nol" element={<h1>Halaman Draf Nol</h1>} />
        <Route path="/naskah" element={<h1>Ruang Penulis</h1>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Naskah baru', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('pilih ide, isi Peta 4 Kotak, judul sementara → Mulai Draf Nol', async () => {
    const calls = pasangFetch({
      [`GET ${P}/ide/`]: { body: IDE },
      [`POST ${P}/naskah/`]: { status: 201, body: naskah({ id: 12, tahap: 'draf_nol' }) },
    })
    const u = userEvent.setup()
    tampil()
    await u.click(await screen.findByRole('radio', { name: /Listrik padam saat hujan/ }))
    expect(screen.getByRole('link', { name: /Cetak petanya/ })).toHaveAttribute('href', '/cetak/PETA-4-KOTAK')
    expect(screen.getByRole('link', { name: /Cetak petanya/ })).toHaveAttribute('target', '_blank')
    await u.type(screen.getByLabelText('Siapa?'), 'Raka dan kakaknya.')
    await u.type(screen.getByLabelText('Mau apa?'), 'Menyelesaikan PR.')
    await u.type(screen.getByLabelText('Ada masalah apa?'), 'Listrik padam.')
    await u.type(screen.getByLabelText('Bagaimana akhirnya?'), 'Belajar pakai senter.')
    const mulai = screen.getByRole('button', { name: 'Mulai Draf Nol' })
    expect(mulai).toBeDisabled()
    await u.type(screen.getByLabelText('Judul sementara'), 'Listrik Padam')
    await u.click(mulai)
    expect(await screen.findByRole('heading', { name: 'Halaman Draf Nol' })).toBeInTheDocument()
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
      judul: 'Listrik Padam', ide: 9,
      peta: { siapa: 'Raka dan kakaknya.', mau_apa: 'Menyelesaikan PR.', masalah: 'Listrik padam.', akhir: 'Belajar pakai senter.' },
    })
  })

  it('ide baru ditulis langsung masuk Bank Ide dulu', async () => {
    const calls = pasangFetch({
      [`GET ${P}/ide/`]: { body: [] },
      [`POST ${P}/ide/`]: { status: 201, body: { id: 33, teks: 'Ayam tetangga', sumur: '', bintang: [], tanggal: '' } },
      [`POST ${P}/naskah/`]: { status: 201, body: naskah({ id: 13, tahap: 'draf_nol' }) },
    })
    const u = userEvent.setup()
    tampil()
    await u.type(await screen.findByLabelText('Ide baru'), 'Ayam tetangga')
    await u.type(screen.getByLabelText('Judul sementara'), 'Ayam')
    await u.click(screen.getByRole('button', { name: 'Mulai Draf Nol' }))
    await screen.findByRole('heading', { name: 'Halaman Draf Nol' })
    const naskahPost = calls.find((c) => c.url === `${P}/naskah/`)
    expect(naskahPost?.body).toMatchObject({ judul: 'Ayam', ide: 33, peta: {} })
  })

  it('Simpan dulu, nanti lanjut: naskah dibuat lalu kembali ke Ruang Penulis; gagal tidak membuat ide kembar', async () => {
    let gagal = true
    const calls = pasangFetch({
      [`GET ${P}/ide/`]: { body: [] },
      [`POST ${P}/ide/`]: { status: 201, body: { id: 33, teks: 'Ayam tetangga', sumur: '', bintang: [], tanggal: '' } },
      [`POST ${P}/naskah/`]: () => {
        if (gagal) {
          gagal = false
          return { status: 400, body: { detail: 'Coba lagi.' } }
        }
        return { status: 201, body: naskah({ id: 13, tahap: 'draf_nol' }) }
      },
    })
    const u = userEvent.setup()
    tampil()
    await u.type(await screen.findByLabelText('Ide baru'), 'Ayam tetangga')
    await u.type(screen.getByLabelText('Judul sementara'), 'Ayam')
    await u.click(screen.getByRole('button', { name: 'Simpan dulu, nanti lanjut' }))
    expect(await screen.findByText('Coba lagi.')).toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: 'Simpan dulu, nanti lanjut' }))
    expect(await screen.findByRole('heading', { name: 'Ruang Penulis' })).toBeInTheDocument()
    expect(calls.filter((c) => c.url === `${P}/ide/` && c.method === 'POST')).toHaveLength(1)
  })
})
