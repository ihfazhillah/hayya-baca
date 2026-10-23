import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Beranda from './Beranda'
import { pasangFetch } from '../../test/fetch'

const peta = [
  { nomor: 1, judul: 'Pengeras Suara', level: 1, emoji: '🔊', status: 'selesai' },
  { nomor: 2, judul: 'Gunting', level: 1, emoji: '✂️', status: 'aktif' },
  { nomor: 6, judul: 'Draf Nol', level: 2, emoji: '📝', status: 'terkunci' },
]
const alat = [
  { kode: 'pengeras', nama: 'Pengeras Suara', emoji: '🔊', warna: '--color-actor-1', stiker: ['perunggu', 'perak'] },
  { kode: 'gunting', nama: 'Gunting', emoji: '✂️', warna: '--color-actor-2', stiker: [] },
]
const beranda = (over: Record<string, unknown> = {}) => ({
  nama: 'Fatih',
  lanjutkan: { modul: { nomor: 2, judul: 'Gunting', emoji: '✂️' }, misi: { id: 21, urutan: 2, judul: 'Potong kalimat' }, pertama_kali: false, perkiraan_menit: 15 },
  pemanasan: { alat: ['Pengeras Suara'], ada: true },
  peta, alat, pangkat: 'Penulis Magang', poin: 145,
  kabar: [{ tanggal: '2026-10-20', jenis: 'stiker', emoji: '🔊', teks: 'Stiker Perak Pengeras Suara', catatan: 'Hebat!', oleh: 'Ummah' }],
  coba_lagi: [{ misi: 23, judul: 'Lembar gunting', modul: 2, catatan: 'Kalimat kedua masih panjang.' }],
  menunggu: 1,
  ...over,
})

function tampil() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Beranda />} />
        <Route path="/modul/:nomor/misi/:urutan" element={<p>Halaman misi</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Beranda', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('menyapa, menonjolkan Kartu Lanjutkan, kabar, peta, alat, dan poin', async () => {
    pasangFetch({
      'GET /api/penerbit/beranda/': { body: beranda() },
      'GET /api/penerbit/modul/2/': {
        body: { nomor: 2, terkunci: false, misi: [{ id: 23, urutan: 4 }] },
      },
    })
    tampil()
    expect(screen.getByRole('heading', { name: 'Beranda' })).toBeInTheDocument()
    expect(await screen.findByText('Assalamu’alaikum, Fatih!')).toBeInTheDocument()
    expect(screen.getByText('Hari ini kita lanjut Modul 2.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mulai' })).toHaveAttribute('href', '/modul/2/misi/2')
    expect(screen.getByRole('link', { name: 'Mulai pemanasan' })).toHaveAttribute('href', '/latihan')
    expect(screen.getByText('Ummah memberi Stiker Perak Pengeras Suara')).toBeInTheDocument()
    expect(screen.getByText('1 lembar menunggu diperiksa')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Modul 2, Gunting, sedang dikerjakan/ })).toHaveClass('aktif')
    expect(screen.getByLabelText('Modul 6, Draf Nol, terkunci')).toHaveClass('terkunci')
    expect(screen.getByText('Level 2 · Penulis Cilik')).toBeInTheDocument()
    expect(screen.getByLabelText('Stiker: Perunggu, Perak')).toBeInTheDocument()
    expect(screen.getByText('145')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tukar poin' })).toHaveAttribute('href', '/tukar')

    // Catatan "coba lagi" membawa anak ke misinya.
    expect(screen.getByText('“Kalimat kedua masih panjang.”')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Kerjakan lagi' }))
    expect(await screen.findByText('Halaman misi')).toBeInTheDocument()
  })

  it('pertama kali: Mulai petualangan Modul 1', async () => {
    pasangFetch({
      'GET /api/penerbit/beranda/': {
        body: beranda({
          lanjutkan: { modul: { nomor: 1, judul: 'Pengeras Suara', emoji: '🔊' }, misi: { id: 1, urutan: 1, judul: 'Angkat tangan' }, pertama_kali: true, perkiraan_menit: 15 },
          pemanasan: { alat: [], ada: false }, kabar: [], coba_lagi: [], menunggu: 0, pangkat: null, poin: 0,
        }),
      },
    })
    tampil()
    expect(await screen.findByRole('heading', { name: 'Mulai petualangan: Modul 1, Pengeras Suara' })).toBeInTheDocument()
    expect(screen.queryByText('Pemanasan hari ini')).toBeNull()
    expect(screen.queryByText('Kabar dari Ayah dan Ummah')).toBeNull()
  })
})
