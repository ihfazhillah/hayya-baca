/** Spec 075 K2 + K3 dari sisi anak: Tanya Ayah atau Ummah di halaman misi, Kartu Pamer di akhir modul. */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Misi from './Misi'
import Modul from './Modul'
import { pasangFetch } from '../../test/fetch'

const ALAT = { kode: 'pengeras', nama: 'Pengeras Suara', emoji: '🔊', warna: '--color-actor-1', slot: [] }
const misiRingkas = (id: number, urutan: number, jenis: string, status: string | null = null) => ({
  id, urutan, judul: `Misi ${urutan}`, tahap: 'mandiri', tahap_label: 'Tanpa petunjuk', jenis,
  jenis_label: jenis, status, tautan: null,
})
const MODUL = {
  nomor: 1, judul: 'Pengeras Suara', emoji: '🔊', level: 1, terkunci: false, tujuan: 'Baca keras.', kenapa: '',
  langkah: [], resep: [], mengapa: '', kamus: [], lapis: '', petunjuk_lihat: '',
  mentor: { tahap: 'tanpa', kartu_prompt: '', pembuka: '' }, bertanya: null,
  misi: [misiRingkas(10, 1, 'tandai'), misiRingkas(11, 2, 'tandai')],
  ujian: [], lembar: [], alat: null,
}
const MISI_10 = {
  id: 10, urutan: 1, judul: 'Misi 1', modul: { nomor: 1, judul: 'Pengeras Suara', alat: 'pengeras' },
  jumlah_misi: 2, berikutnya: 11, tahap: 'mandiri', tahap_label: 'Tanpa petunjuk', jenis: 'tandai',
  petunjuk: 'Baca keras-keras.', status: null,
}

function tampil(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/modul/:nomor/misi/:urutan" element={<Misi />} />
        <Route path="/modul/:nomor" element={<Modul />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Tanya Ayah atau Ummah', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('anak menulis satu kalimat dari halaman misi, lalu boleh lanjut', async () => {
    const calls = pasangFetch({
      'GET /api/penerbit/modul/1/': { body: { ...MODUL, alat: ALAT } },
      'GET /api/penerbit/misi/10/': { body: MISI_10 },
      'GET /api/penerbit/pertanyaan/': { body: [] },
      'POST /api/penerbit/pertanyaan/': {
        status: 201,
        body: { id: 3, teks: 'Apa itu tersandung?', dijawab: false, catatan: '', pesan: 'x' },
      },
    })
    tampil('/modul/1/misi/1')
    await userEvent.click(await screen.findByRole('button', { name: 'Aku mau tanya Ayah atau Ummah' }))
    const kotak = screen.getByLabelText('Pertanyaanmu')
    expect(kotak).toHaveAttribute('maxLength', '300')
    expect(screen.getByRole('button', { name: 'Kirim' })).toBeDisabled()
    await userEvent.type(kotak, 'Apa itu tersandung?')
    await userEvent.click(screen.getByRole('button', { name: 'Kirim' }))
    expect(await screen.findByText('Pertanyaanmu sudah dikirim. Kamu boleh lanjut dulu.')).toBeInTheDocument()
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ teks: 'Apa itu tersandung?', misi: 10 })
    expect(screen.getByText('Apa itu tersandung?')).toBeInTheDocument()
  })

  it('jawaban Ayah muncul di bawah pertanyaannya', async () => {
    pasangFetch({
      'GET /api/penerbit/modul/1/': { body: { ...MODUL, alat: ALAT } },
      'GET /api/penerbit/misi/10/': { body: MISI_10 },
      'GET /api/penerbit/pertanyaan/': {
        body: [{ id: 3, teks: 'Apa itu tersandung?', dijawab: true, dijawab_oleh: 'Ayah', catatan: 'Lidah berhenti tiba-tiba.' }],
      },
    })
    tampil('/modul/1/misi/1')
    const daftar = await screen.findByRole('list', { name: 'Pertanyaanmu di misi ini' })
    expect(within(daftar).getByText('Apa itu tersandung?')).toBeInTheDocument()
    expect(within(daftar).getByText(/Ayah: “Lidah berhenti tiba-tiba.”/)).toBeInTheDocument()
  })
})

describe('Kartu Pamer', () => {
  afterEach(() => vi.unstubAllGlobals())

  const SELESAI = { ...MODUL, misi: [misiRingkas(10, 1, 'klik', 'selesai'), misiRingkas(11, 2, 'tandai', 'selesai')] }

  it('belum terbuka sebelum misi utama selesai', async () => {
    pasangFetch({
      'GET /api/penerbit/modul/1/': { body: MODUL },
      'GET /api/penerbit/modul/1/kartu-pamer/': { body: { tersedia: false, hasil: null, kartu: null } },
    })
    tampil('/modul/1')
    const kartu = await screen.findByRole('region', { name: 'Kartu Pamer' })
    expect(within(kartu).getByText(/Selesaikan misinya dulu/)).toBeInTheDocument()
    expect(within(kartu).queryByLabelText('Yang aku pelajari')).not.toBeInTheDocument()
  })

  it('sebelum/sesudah, kalimat wajib, rekaman tetap di tablet, lalu tunjukkan ke Ayah', async () => {
    const calls = pasangFetch({
      'GET /api/penerbit/modul/1/': { body: SELESAI },
      'GET /api/penerbit/modul/1/kartu-pamer/': {
        body: { tersedia: true, kartu: null,
          hasil: { misi: 3, judul: 'Oren dan ikan', sebelum: 'Oren sangat sangat suka ikan.', sesudah: 'Oren sangat suka ikan.' } },
      },
      'POST /api/penerbit/modul/1/kartu-pamer/': {
        status: 201, body: { id: 1, pelajaran: 'Telingaku bisa menemukan kesalahan.', reaksi_emoji: '', reaksi: '', reaksi_oleh: null },
      },
    })
    tampil('/modul/1')
    const kartu = await screen.findByRole('region', { name: 'Kartu Pamer' })
    expect(within(kartu).getByText('Oren sangat sangat suka ikan.')).toBeInTheDocument()
    expect(within(kartu).getByText('Oren sangat suka ikan.')).toBeInTheDocument()
    expect(within(kartu).getByText(/hanya ada di tablet ini/)).toBeInTheDocument()
    const simpan = within(kartu).getByRole('button', { name: 'Simpan kartu' })
    expect(simpan).toBeDisabled()
    await userEvent.type(within(kartu).getByLabelText('Yang aku pelajari'), 'Telingaku bisa menemukan kesalahan.')
    await userEvent.click(simpan)
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ pelajaran: 'Telingaku bisa menemukan kesalahan.' })
    await userEvent.click(await within(kartu).findByRole('button', { name: 'Tunjukkan ke Ayah atau Ummah' }))
    expect(within(kartu).getByText(/Panggil Ayah atau Ummah/)).toBeInTheDocument()
  })

  it('reaksi Ayah tampil di kartu', async () => {
    pasangFetch({
      'GET /api/penerbit/modul/1/': { body: SELESAI },
      'GET /api/penerbit/modul/1/kartu-pamer/': {
        body: { tersedia: true, hasil: null,
          kartu: { id: 1, pelajaran: 'Telingaku pintar.', reaksi_emoji: '👏', reaksi: 'Ayah bangga!', reaksi_oleh: 'Ayah' } },
      },
    })
    tampil('/modul/1')
    const kartu = await screen.findByRole('region', { name: 'Kartu Pamer' })
    expect(within(kartu).getByDisplayValue('Telingaku pintar.')).toBeInTheDocument()
    expect(within(kartu).getByText(/Ayah: 👏 “Ayah bangga!”/)).toBeInTheDocument()
  })
})
