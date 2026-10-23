import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Misi from './Misi'
import { pasangFetch } from '../../test/fetch'
import type { Token } from '../../types'

function tokens(teks: string): Token[] {
  return (teks.match(/\w+|\s+|./g) ?? []).map((t, i) => ({
    i, t, j: /^\s+$/.test(t) ? 'spasi' : /^\w/.test(t) ? 'kata' : 'tanda',
  }))
}

const ALAT = { kode: 'pengeras', nama: 'Pengeras Suara', emoji: '🔊', warna: '--color-actor-1', slot: [] }
const misiRingkas = (id: number, urutan: number, jenis = 'klik') => ({
  id, urutan, judul: `Misi ${urutan}`, tahap: 'petunjuk', tahap_label: 'Dengan petunjuk', jenis,
  jenis_label: jenis, status: null, tautan: null,
})
const MODUL = {
  nomor: 1, judul: 'Pengeras Suara', emoji: '🔊', level: 1, terkunci: false, tujuan: '', kenapa: '',
  langkah: [], resep: [], mengapa: '', kamus: [], lapis: '', petunjuk_lihat: '',
  mentor: { tahap: 'tanpa', kartu_prompt: '', pembuka: '' }, bertanya: null,
  misi: [misiRingkas(10, 1, 'tandai'), misiRingkas(11, 2), misiRingkas(12, 3, 'cetak')],
  ujian: [], lembar: [], alat: ALAT,
}
const dasarMisi = {
  modul: { nomor: 1, judul: 'Pengeras Suara', alat: 'pengeras' }, jumlah_misi: 3,
  tahap: 'petunjuk', tahap_label: 'Dengan petunjuk', petunjuk: 'Baca keras-keras, lalu klik kata yang salah.',
  status: null,
}

function tampil(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/modul/:nomor/misi/:urutan" element={<Misi />} />
        <Route path="/modul/:nomor" element={<p>Halaman modul</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Misi', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('klik kesalahan sampai selesai: versi benar dan tombol Misi berikutnya', async () => {
    const calls = pasangFetch({
      'GET /api/penerbit/modul/1/': { body: MODUL },
      'GET /api/penerbit/misi/11/': {
        body: {
          ...dasarMisi, id: 11, urutan: 2, berikutnya: 12, judul: 'Klik 1 kesalahan', jenis: 'klik',
          tokens: tokens('Oren di di dapur.'), jumlah: 1, percobaan: { diklik: [], meleset: 0, pakai_petunjuk: false },
        },
      },
      'POST /api/penerbit/misi/11/klik/': {
        body: {
          hasil: 'ketemu', ditemukan: 1, total: 1, meleset: 0, boleh_petunjuk: false, selesai: true,
          versi_benar: 'Oren di dapur.', kunci: [[{ token: [4, 5], celah: null }]], hadiah_baru: [],
        },
      },
    })
    tampil('/modul/1/misi/2')
    expect(await screen.findByRole('heading', { name: 'Klik 1 kesalahan' })).toBeInTheDocument()
    expect(screen.getByText('Misi 2 dari 3')).toBeInTheDocument()
    expect(screen.getByText('🔊 Pengeras Suara · Dengan petunjuk')).toBeInTheDocument()
    // Jumlah kesalahan cukup sekali, di penghitung (petunjuk misi sudah menyebutnya).
    expect(screen.getByText('0 dari 1 kesalahan ditemukan')).toBeInTheDocument()
    expect(screen.queryByText('Ada 1 kesalahan.')).toBeNull()

    await userEvent.click(screen.getAllByRole('button', { name: 'di' })[1])
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ token: 4 })
    expect(await screen.findByText('Oren di dapur.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Misi 2 selesai!' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Misi berikutnya' })).toHaveAttribute('href', '/modul/1/misi/3')
    expect(screen.getByRole('link', { name: 'Kembali ke modul' })).toHaveAttribute('href', '/modul/1')
  })

  it('misi yang sudah selesai langsung menampilkan jawabannya', async () => {
    pasangFetch({
      'GET /api/penerbit/modul/1/': { body: MODUL },
      'GET /api/penerbit/misi/11/': {
        body: {
          ...dasarMisi, id: 11, urutan: 2, berikutnya: 12, judul: 'Klik 1 kesalahan', jenis: 'klik', status: 'selesai',
          tokens: tokens('Oren di di dapur.'), versi_benar: 'Oren di dapur.',
        },
      },
    })
    tampil('/modul/1/misi/2')
    expect(await screen.findByText('Oren di dapur.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Misi 2 selesai!' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'di' })).toBeNull()
  })

  it('tahap tanpa petunjuk: setelah muat ulang penghitung tetap menunjukkan yang sudah ketemu', async () => {
    pasangFetch({
      'GET /api/penerbit/modul/1/': { body: MODUL },
      'GET /api/penerbit/misi/11/': {
        body: {
          ...dasarMisi, id: 11, urutan: 2, berikutnya: 12, judul: 'Lantai licin', jenis: 'klik', tahap: 'mandiri',
          tokens: tokens('Oren di di dapur.'), percobaan: { diklik: [2], meleset: 1, pakai_petunjuk: false },
        },
      },
    })
    tampil('/modul/1/misi/2')
    expect(await screen.findByText('1 kesalahan ditemukan')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'di' })[0]).toHaveClass('ditemukan')
    // Titik bukan tombol di luar mode celah.
    expect(screen.queryByRole('button', { name: '.' })).toBeNull()
  })

  it('misi tandai dengan tautan aplikasi membuka halaman di tab yang sama', async () => {
    pasangFetch({
      'GET /api/penerbit/modul/1/': { body: MODUL },
      'GET /api/penerbit/misi/10/': {
        body: { ...dasarMisi, id: 10, urutan: 1, berikutnya: 11, judul: 'Tulis ide', jenis: 'tandai', tautan: '/naskah/' },
      },
    })
    tampil('/modul/1/misi/1')
    const tautan = await screen.findByRole('link', { name: /Buka Ruang Penulis/ })
    expect(tautan).toHaveAttribute('href', '/naskah/')
    expect(tautan).not.toHaveAttribute('target')
  })

  it('misi cetak membuka lembar lalu menunggu diperiksa, anak boleh lanjut', async () => {
    const buka = vi.fn()
    vi.stubGlobal('open', buka)
    const calls = pasangFetch({
      'GET /api/penerbit/modul/1/': { body: MODUL },
      'GET /api/penerbit/misi/12/': {
        body: {
          ...dasarMisi, id: 12, urutan: 3, berikutnya: null, judul: 'Baca keras satu halaman', jenis: 'cetak',
          lembar: { kode: 'M1-4', judul: 'Dunia nyata' },
        },
      },
      'POST /api/penerbit/misi/12/cetak/': { body: { status: 'menunggu', lembar: 'M1-4' } },
    })
    tampil('/modul/1/misi/3')
    await userEvent.click(await screen.findByRole('button', { name: '🖨️ Cetak lembar ini' }))
    expect(buka).toHaveBeenCalledWith('/cetak/M1-4', '_blank', 'noopener')
    // Mencetak belum berarti menyerahkan: anak menekan tombol kedua setelah mengerjakan.
    expect(calls.some((c) => c.method === 'POST')).toBe(false)
    await userEvent.click(screen.getByRole('button', { name: 'Sudah aku kerjakan, serahkan ke Ayah atau Ummah' }))
    expect(calls.some((c) => c.method === 'POST' && c.url === '/api/penerbit/misi/12/cetak/')).toBe(true)
    expect(await screen.findByText('menunggu diperiksa Ayah atau Ummah')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Kembali ke modul' })).toBeInTheDocument()
  })

  it('misi tandai: petunjuk orang tua terlipat lalu Tandai selesai', async () => {
    pasangFetch({
      'GET /api/penerbit/modul/1/': { body: MODUL },
      'GET /api/penerbit/misi/10/': {
        body: {
          ...dasarMisi, id: 10, urutan: 1, berikutnya: 11, judul: 'Angkat tangan', jenis: 'tandai', tahap: 'bersama',
          tahap_label: 'Bersama Ayah', petunjuk_ortu: 'Bacakan teks sambil tersandung.',
        },
      },
      'POST /api/penerbit/misi/10/tandai/': { body: { selesai: true, hadiah_baru: [] } },
    })
    tampil('/modul/1/misi/1')
    expect(await screen.findByText('Untuk Ayah atau Ummah')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Tandai selesai' }))
    expect(await screen.findByRole('heading', { name: 'Misi 1 selesai!' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Misi berikutnya' })).toHaveAttribute('href', '/modul/1/misi/2')
  })
})
