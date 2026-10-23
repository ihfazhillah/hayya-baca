import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pasangFetch } from '../../test/fetch'
import { ALAT, P, TEKS_V1, naskah, stempel, versi } from '../../editor/fixtur'
import type { Sorotan } from '../../types'
import Revisi from './Revisi'

vi.mock('../../editor/Editor', async () => await import('../../editor/EditorPalsu'))

const MODUL_12 = {
  nomor: 12, judul: 'Lapis 3: Kalimat', emoji: '✂️', level: 3, terkunci: false,
  mentor: { tahap: 'isian', kartu_prompt: 'Aku sedang di Revisi Lapis 3.', pembuka: 'Kamu editor.',
    isian_awal: ['Aku sedang di Lapis 3.', '', 'Tolong beri 2 pertanyaan.', ''] },
  misi: [
    { id: 121, urutan: 1, judul: 'Lingkari kata kembar', tahap: 'mandiri', tahap_label: '', jenis: 'tandai', jenis_label: '', status: null, tautan: null },
    { id: 122, urutan: 2, judul: 'Ganti atau hapus', tahap: 'mandiri', tahap_label: '', jenis: 'tandai', jenis_label: '', status: 'selesai', tautan: null },
    { id: 123, urutan: 3, judul: 'Gunting 2 kalimat', tahap: 'mandiri', tahap_label: '', jenis: 'tandai', jenis_label: '', status: null, tautan: null },
  ],
}

const SOROTAN_V3: Sorotan[] = [{ alat: 'kamera', index: 20, length: 5, sumber: 'anak', diperbaiki: true }]

function n3(over = {}) {
  return naskah({
    stempel: stempel(['peta', 'kamera']), lapis_berikutnya: 'gunting',
    versi: [
      { nomor: 1, lapis: '', tanggal: '', jumlah_kata: 6 },
      { nomor: 2, lapis: 'peta', tanggal: '', jumlah_kata: 7 },
      { nomor: 3, lapis: 'kamera', tanggal: '', jumlah_kata: 8 },
    ],
    ...over,
  })
}

function tampil() {
  return render(
    <MemoryRouter initialEntries={['/naskah/5/revisi/gunting']}>
      <Routes><Route path="/naskah/:id/revisi/:lapis" element={<Revisi />} /></Routes>
    </MemoryRouter>,
  )
}

describe('Revisi per lapis', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('Stabilo dulu di versi terakhir, lalu Revisi dengan sorotan sistem, simpan versi dan minta stempel', async () => {
    let versiTersimpan = false
    const calls = pasangFetch({
      [`GET ${P}/naskah/5/`]: () => ({
        body: versiTersimpan
          ? n3({ versi: [...n3().versi, { nomor: 4, lapis: 'gunting', tanggal: '', jumlah_kata: 9 }] })
          : n3(),
      }),
      [`GET ${P}/alat/`]: { body: { alat: ALAT } },
      [`GET ${P}/modul/12/`]: { body: MODUL_12 },
      [`GET ${P}/naskah/5/versi/3/`]: { body: versi(3, TEKS_V1, { lapis: 'kamera', sorotan: [...SOROTAN_V3, { alat: 'kembar', index: 0, length: 5, sumber: 'sistem' as const, diperbaiki: false }] }) },
      [`POST ${P}/naskah/5/simpan/`]: { body: { tersimpan: '', waktu_klien: 1 } },
      [`GET ${P}/naskah/5/sorotan-sistem/`]: { body: [{ alat: 'kembar', index: 0, length: 5, sumber: 'sistem', diperbaiki: false }] },
      [`POST ${P}/misi/121/tandai/`]: { body: { selesai: true, hadiah_baru: [] } },
      [`POST ${P}/naskah/5/versi/`]: () => {
        versiTersimpan = true
        return { status: 201, body: { nomor: 4, lapis: 'gunting', hadiah_baru: [] } }
      },
      [`POST ${P}/naskah/5/minta-stempel/`]: { body: { stempel_diminta: 'gunting' } },
    })
    const u = userEvent.setup()
    tampil()
    expect(await screen.findByRole('heading', { name: 'Revisi Lapis 3' })).toBeInTheDocument()

    // misi kecil Level 3 untuk lapis ini
    expect(await screen.findByText('Lingkari kata kembar')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Ganti atau hapus' })).toBeChecked()
    await u.click(screen.getByRole('checkbox', { name: 'Lingkari kata kembar' }))
    expect(calls.some((c) => c.url === `${P}/misi/121/tandai/`)).toBe(true)
    expect(screen.getByRole('checkbox', { name: 'Lingkari kata kembar' })).toBeChecked()

    // langkah 1: stabilo, hanya alat yang sudah dipelajari, sorotan anak dibawa, sistem dibuang
    const ed = await screen.findByTestId('editor')
    expect(ed).toHaveAttribute('data-mode', 'stabilo')
    expect(ed).toHaveAttribute('data-sorotan', '1')
    expect(within(ed).getByText('gunting,kembar,pengeras,kamera')).toBeInTheDocument()

    await u.click(screen.getByRole('button', { name: /Selesai menyorot/ }))
    const ed2 = await screen.findByTestId('editor')
    expect(ed2).toHaveAttribute('data-mode', 'revisi')
    expect(ed2).toHaveAttribute('data-sorotan', '2')
    const sistem = calls.find((c) => c.url.includes('sorotan-sistem'))
    expect(sistem?.url).toContain('alat=kembar,gunting')
    expect(calls.find((c) => c.url === `${P}/naskah/5/simpan/`)?.body).toMatchObject({ lapis: 'gunting', teks: TEKS_V1 })

    expect(screen.getByRole('button', { name: 'Minta stempel ke Ayah atau Ummah' })).toBeDisabled()
    await u.click(screen.getByRole('button', { name: 'ketik palsu' }))
    await u.click(screen.getByRole('button', { name: 'Simpan sebagai Versi 4' }))
    expect(await screen.findByText('Versi 4 tersimpan ✓')).toBeInTheDocument()
    expect(calls.find((c) => c.url === `${P}/naskah/5/versi/`)?.body).toEqual({ lapis: 'gunting' })
    const simpanTerakhir = calls.filter((c) => c.url === `${P}/naskah/5/simpan/`).at(-1)
    expect(simpanTerakhir?.body).toMatchObject({ teks: `${TEKS_V1} tambah`, lapis: 'gunting' })

    await u.click(screen.getByRole('button', { name: 'Minta stempel ke Ayah atau Ummah' }))
    expect(await screen.findByText(/Stempel sudah diminta/)).toBeInTheDocument()
    expect(calls.find((c) => c.url.endsWith('minta-stempel/'))?.body).toEqual({ lapis: 'gunting' })
  })

  it('draf lapis yang sama dilanjutkan langsung di mode Revisi', async () => {
    pasangFetch({
      [`GET ${P}/naskah/5/`]: { body: n3({ draf: { isi: { ops: [] }, teks: 'Draf lanjutan.', sorotan: [], lapis: 'gunting', waktu_klien: 5, menulis_tambahan_dari: null } }) },
      [`GET ${P}/alat/`]: { body: { alat: ALAT } },
      [`GET ${P}/modul/12/`]: { body: MODUL_12 },
    })
    tampil()
    const ed = await screen.findByTestId('editor')
    expect(ed).toHaveAttribute('data-mode', 'revisi')
    expect(ed).toHaveTextContent('Draf lanjutan.')
  })

  it('Cetak versi terakhir: sorotan dicetak dengan pola hitam putih', async () => {
    const print = vi.fn()
    vi.stubGlobal('print', print)
    const v3 = versi(3, TEKS_V1, { sorotan: [{ alat: 'gunting', index: 0, length: 5, sumber: 'anak', diperbaiki: false }] })
    pasangFetch({
      [`GET ${P}/naskah/5/`]: { body: n3() },
      [`GET ${P}/alat/`]: { body: { alat: ALAT } },
      [`GET ${P}/modul/12/`]: { body: MODUL_12 },
      [`GET ${P}/naskah/5/versi/3/`]: { body: v3 },
    })
    const u = userEvent.setup()
    tampil()
    await screen.findByTestId('editor')
    await u.click(screen.getByRole('button', { name: /Cetak Versi 3/ }))
    const lembar = await screen.findByRole('article', { name: 'Cetak Versi 3' })
    const pola = lembar.querySelector('.cetak-naskah .pola-putus')
    expect(pola).toHaveTextContent('Fatih')
    await vi.waitFor(() => expect(print).toHaveBeenCalled())
  })

  it('kotak Mentor AI lapis ini tampil di halaman revisi', async () => {
    pasangFetch({
      [`GET ${P}/naskah/5/`]: { body: n3() },
      [`GET ${P}/alat/`]: { body: { alat: ALAT } },
      [`GET ${P}/modul/12/`]: { body: MODUL_12 },
      [`GET ${P}/naskah/5/versi/3/`]: { body: versi(3, TEKS_V1, { lapis: 'kamera', sorotan: SOROTAN_V3 }) },
    })
    tampil()
    expect(await screen.findByRole('region', { name: 'Mentor AI' })).toHaveTextContent('Isian')
  })

  it('naskah yang masih di laci belum bisa direvisi', async () => {
    pasangFetch({
      [`GET ${P}/naskah/5/`]: { body: naskah({ tahap: 'laci' }) },
      [`GET ${P}/alat/`]: { body: { alat: ALAT } },
      [`GET ${P}/modul/12/`]: { body: MODUL_12 },
    })
    tampil()
    expect(await screen.findByText('Naskah ini masih di Laci Rahasia.')).toBeInTheDocument()
    expect(screen.queryByTestId('editor')).toBeNull()
  })
})
