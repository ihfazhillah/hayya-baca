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
      [`PATCH ${P}/naskah/5/versi/3/`]: { body: { nomor: 3, sorotan: [] } },
    })
    const u = userEvent.setup()
    tampil()
    expect(await screen.findByText('Revisi Lapis 3')).toBeInTheDocument()

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
    // sorotan Langkah 1 juga disimpan di versi yang disorot (untuk Sebelum dan Sesudah)
    const sorot = calls.find((c) => c.method === 'PATCH' && c.url === `${P}/naskah/5/versi/3/`)
    expect((sorot?.body as { sorotan: { sumber: string }[] }).sorotan.every((x) => x.sumber === 'anak')).toBe(true)

    expect(screen.getByRole('button', { name: 'Minta stempel ke Ayah atau Ummah' })).toBeDisabled()
    await u.click(screen.getByRole('button', { name: 'ketik palsu' }))
    await u.click(screen.getByRole('button', { name: 'Simpan sebagai Versi 4' }))
    expect(await screen.findByText('Versi 4 tersimpan ✓')).toBeInTheDocument()
    // tanpa perubahan baru tidak bisa menyimpan versi kembar
    expect(screen.getByRole('button', { name: 'Simpan sebagai Versi 5' })).toBeDisabled()
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

  it('sorotan Langkah 1 tersimpan otomatis; muat ulang kembali ke Langkah 1 dengan sorotannya', async () => {
    const sorotanAnak: Sorotan[] = [{ alat: 'gunting', index: 0, length: 5, sumber: 'anak', diperbaiki: false }]
    const calls = pasangFetch({
      [`GET ${P}/naskah/5/`]: { body: n3({ draf: { isi: { ops: [{ insert: TEKS_V1 + '\n' }] }, teks: TEKS_V1, sorotan: sorotanAnak, lapis: 'gunting', waktu_klien: 5, menulis_tambahan_dari: null } }) },
      [`GET ${P}/alat/`]: { body: { alat: ALAT } },
      [`GET ${P}/modul/12/`]: { body: MODUL_12 },
      [`GET ${P}/naskah/5/versi/3/`]: { body: versi(3, TEKS_V1, { lapis: 'kamera', sorotan: SOROTAN_V3 }) },
      [`POST ${P}/naskah/5/simpan/`]: { body: { tersimpan: '', waktu_klien: 6 } },
    })
    const u = userEvent.setup()
    tampil()
    const ed = await screen.findByTestId('editor')
    expect(ed).toHaveAttribute('data-mode', 'stabilo')
    expect(ed).toHaveAttribute('data-sorotan', '1')
    // perubahan di Langkah 1 ikut disimpan otomatis
    await u.click(screen.getByRole('button', { name: 'ketik palsu' }))
    expect(screen.getByText('Menyimpan…')).toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: /Selesai menyorot/ }))
    expect(calls.find((c) => c.url === `${P}/naskah/5/simpan/`)?.body).toMatchObject({ lapis: 'gunting', sorotan: sorotanAnak })
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

  it('kembali dari tampilan cetak tidak membuang ketikan Langkah 2', async () => {
    vi.stubGlobal('print', vi.fn())
    pasangFetch({
      [`GET ${P}/naskah/5/`]: { body: n3({ draf: { isi: { ops: [] }, teks: 'Draf lanjutan.', sorotan: [], lapis: 'gunting', waktu_klien: 5, menulis_tambahan_dari: null } }) },
      [`GET ${P}/alat/`]: { body: { alat: ALAT } },
      [`GET ${P}/modul/12/`]: { body: MODUL_12 },
      [`GET ${P}/naskah/5/versi/3/`]: { body: versi(3, TEKS_V1) },
      [`POST ${P}/naskah/5/simpan/`]: { body: { tersimpan: '', waktu_klien: 6 } },
    })
    const u = userEvent.setup()
    tampil()
    await screen.findByText('Draf lanjutan.')
    await u.click(screen.getByRole('button', { name: 'ketik palsu' }))
    await u.click(screen.getByRole('button', { name: /Cetak Versi 3/ }))
    await u.click(await screen.findByRole('button', { name: /Kembali ke revisi/ }))
    const ed = await screen.findByTestId('editor')
    expect(ed).toHaveAttribute('data-mode', 'revisi')
    expect(ed).toHaveTextContent('Draf lanjutan. tambah')
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

  it('Nama tokoh: hapus dan tambah nama, lalu tanda sistem diperbarui', async () => {
    const TOKOH = { nama: ['Fatih'], otomatis: ['Fatih'], tambah: [], abaikan: [], kata: ['fatih'] }
    const calls = pasangFetch({
      [`GET ${P}/naskah/5/`]: { body: n3({ tokoh: TOKOH, draf: { isi: { ops: [] }, teks: 'Draf lanjutan.', sorotan: [], lapis: 'gunting', waktu_klien: 5, menulis_tambahan_dari: null } }) },
      [`GET ${P}/alat/`]: { body: { alat: ALAT } },
      [`GET ${P}/modul/12/`]: { body: MODUL_12 },
      [`GET ${P}/naskah/5/versi/3/`]: { body: versi(3, TEKS_V1) },
      [`POST ${P}/naskah/5/simpan/`]: { body: { tersimpan: '', waktu_klien: 6 } },
      [`GET ${P}/naskah/5/sorotan-sistem/`]: { body: [{ alat: 'kembar', index: 0, length: 5, sumber: 'sistem', diperbaiki: false }] },
      [`POST ${P}/naskah/5/tokoh/`]: (_u, init) => {
        const b = JSON.parse(String(init.body))
        const nama = b.hapus ? [] : ['Bu Siti']
        return { body: { tokoh: { ...TOKOH, nama, abaikan: b.hapus ? ['fatih'] : [] }, hadiah_baru: [] } }
      },
    })
    const u = userEvent.setup()
    tampil()
    const ed = await screen.findByTestId('editor')
    expect(ed).toHaveAttribute('data-sorotan', '0')
    const kotak = screen.getByRole('group', { name: 'Nama tokoh' })
    expect(within(kotak).getByText('Nama tokoh tidak dihitung sebagai kata kembar.')).toBeInTheDocument()
    expect(within(kotak).getByText('Fatih')).toBeInTheDocument()

    await u.click(within(kotak).getByRole('button', { name: 'Hapus nama Fatih' }))
    expect(calls.find((c) => c.url === `${P}/naskah/5/tokoh/`)?.body).toEqual({ hapus: 'Fatih' })
    await vi.waitFor(() => expect(within(kotak).queryByText('Fatih')).toBeNull())
    // tanda sistem dimuat ulang dengan nama tokoh yang baru
    await vi.waitFor(() => expect(screen.getByTestId('editor')).toHaveAttribute('data-sorotan', '1'))
    expect(calls.some((c) => c.url.includes('sorotan-sistem'))).toBe(true)

    await u.type(within(kotak).getByRole('textbox', { name: 'Tambah nama tokoh' }), 'Bu Siti')
    await u.click(within(kotak).getByRole('button', { name: '+ Tambah nama' }))
    expect(calls.filter((c) => c.url === `${P}/naskah/5/tokoh/`).at(-1)?.body).toEqual({ tambah: 'Bu Siti' })
    expect(await within(kotak).findByText('Bu Siti')).toBeInTheDocument()
    expect(within(kotak).getByRole('textbox', { name: 'Tambah nama tokoh' })).toHaveValue('')
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
