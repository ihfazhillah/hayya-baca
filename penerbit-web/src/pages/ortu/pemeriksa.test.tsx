import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pasangFetch } from '../../test/fetch'
import { ME_ORTU, tampilHalaman } from '../ujiHalaman'
import Dasbor from './Dasbor'
import DaftarLembar from './DaftarLembar'
import PemeriksaanLembar from './PemeriksaanLembar'
import NaskahPenulis from './NaskahPenulis'
import DaftarNaskah from './DaftarNaskah'
import CetakModul from './CetakModul'
import HadiahPoin from './HadiahPoin'
import PromptAnak from './PromptAnak'

const P = '/api/penerbit'

const LEMBAR = {
  kode: 'M4-3', judul: 'Kamera: ubah kalimat perasaan', petunjuk: 'Ubah kalimat "bilang perasaan" menjadi kalimat Kamera.',
  soal: 'Ibu marah.\nOren senang.', baris_tulis: 4, pertanyaan_bantu: 'Apa yang dilakukan tangannya?',
  cek_sendiri: ['Kalimatku tidak memakai kata "marah".', 'Pembaca bisa membayangkan gerakannya.'],
  kriteria: 'Perasaan ditunjukkan lewat tindakan.', contoh_jawaban: 'Ibu meletakkan sapu dengan keras.',
  saran_stiker: 'Beri Perak kalau kedua kalimat benar.', modul: { nomor: 4, judul: 'Kamera' },
}

const DASBOR = {
  penulis: { id: 1, nama: 'Fatih' },
  perlu_tindakan: { lembar: 3, stempel: 1, penukaran: 2 },
  minggu_ini: { sesi: 3, misi_selesai: 9, kata_draf_nol: 120, alat: 'Detektor Kembar' },
  persiapan: { modul: { nomor: 3, judul: 'Detektor Kembar', petunjuk_lihat: 'Lingkari kata "terus" bersama.', lembar: ['M3-2'] } },
  aktivitas: [{ tanggal: '2026-10-20T09:12:00Z', teks: 'Misi 3.1 selesai, 4 dari 4' }],
}

describe('Pojok Orang Tua', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('Dasbor: orang tua tanpa penulis aktif bisa mengaktifkan anaknya, lalu melihat dasbor', async () => {
    let aktif = false
    const calls = pasangFetch({
      'GET /api/penerbit/me/': () => ({
        body: aktif ? ME_ORTU : { ...ME_ORTU, peran: [], pemeriksa: [], bisa_diaktifkan: [{ child_id: 7, nama: 'Fatih' }] },
      }),
      'POST /api/penerbit/ortu/penulis/': () => { aktif = true; return { status: 201, body: { id: 1, nama: 'Fatih' } } },
      'GET /api/penerbit/ortu/dasbor/': { body: DASBOR },
    })
    tampilHalaman('/ortu', { '/ortu': <Dasbor /> })
    await userEvent.click(await screen.findByRole('button', { name: 'Aktifkan Penerbit Rumah untuk Fatih' }))
    expect(calls.find((c) => c.method === 'POST')?.body).toMatchObject({ child_id: 7 })
    const lembar = await screen.findByRole('link', { name: /3\s*lembar menunggu diperiksa/ })
    expect(lembar).toHaveAttribute('href', '/ortu/lembar?status=menunggu')
    expect(screen.getByRole('link', { name: /naskah minta stempel/ })).toHaveAttribute('href', '/ortu/naskah')
    expect(screen.getByRole('link', { name: /penukaran poin diajukan/ })).toHaveAttribute('href', '/ortu/hadiah')
    expect(screen.getByRole('link', { name: /Cetak M3-2/ })).toHaveAttribute('href', '/cetak/M3-2')
    expect(screen.getByText('Misi 3.1 selesai, 4 dari 4')).toBeInTheDocument()
    expect(calls.some((c) => c.url.startsWith(`${P}/ortu/dasbor/?penulis=1`))).toBe(true)
  })

  it('Daftar lembar: mencari kode dari kertas di tangan', async () => {
    const calls = pasangFetch({
      'GET /api/penerbit/me/': { body: ME_ORTU },
      'GET /api/penerbit/ortu/lembar/': (url) => ({
        body: url.includes('kode=M4') ? [{ id: 5, kode: 'M4-3', judul: 'Kamera', modul: 4, status: 'menunggu', catatan: '', tanggal_cetak: '2026-10-18T08:00:00Z', diperiksa_oleh: null }] : [],
      }),
    })
    tampilHalaman('/ortu/lembar?status=menunggu', { '/ortu/lembar': <DaftarLembar /> })
    await userEvent.type(await screen.findByLabelText('Cari kode di kertas'), 'M4')
    expect(await screen.findByRole('link', { name: 'Periksa' })).toHaveAttribute('href', '/ortu/lembar/5')
    expect(calls.some((c) => c.url.includes('status=menunggu') && c.url.includes('kode=M4'))).toBe(true)
  })

  it('Pemeriksaan: Coba lagi mengirim catatan untuk anak lalu pindah ke lembar berikutnya', async () => {
    const detail = (id: number, kode: string) => ({
      body: { id, kode, judul: 'Kamera', modul: 4, status: 'menunggu', catatan: '', tanggal_cetak: '2026-10-18T08:00:00Z',
        diperiksa_oleh: null, lembar: { ...LEMBAR, kode }, misi: 'Misi 3', alat: 'kamera' },
    })
    const calls = pasangFetch({
      'GET /api/penerbit/me/': { body: ME_ORTU },
      'GET /api/penerbit/ortu/lembar/5/': detail(5, 'M4-3'),
      'GET /api/penerbit/ortu/lembar/6/': detail(6, 'M4-4'),
      'POST /api/penerbit/ortu/lembar/5/': { body: { id: 5, status: 'coba_lagi', hadiah_baru: [] } },
      'GET /api/penerbit/ortu/stiker/': {
        body: { alat: [{ kode: 'kamera', nama: 'Kamera', slot: [
          { tingkat: 'perunggu', punya: true }, { tingkat: 'perak', punya: false }, { tingkat: 'emas', punya: false },
        ] }], stempel: [] },
      },
      'GET /api/penerbit/ortu/lembar/': {
        body: [
          { id: 5, kode: 'M4-3', status: 'menunggu', tanggal_cetak: '2026-10-18T08:00:00Z' },
          { id: 6, kode: 'M4-4', status: 'menunggu', tanggal_cetak: '2026-10-17T08:00:00Z' },
        ],
      },
    })
    tampilHalaman('/ortu/lembar/5', { '/ortu/lembar/:id': <PemeriksaanLembar /> })
    expect(await screen.findByText('Ibu meletakkan sapu dengan keras.')).toBeInTheDocument()
    const u = userEvent.setup()
    // Stiker yang sudah dimiliki tidak bisa dipilih lagi.
    expect(await screen.findByLabelText(/Perunggu \(sudah\)/)).toBeDisabled()
    expect(screen.getByLabelText(/Perak/)).toBeEnabled()
    await u.click(screen.getByLabelText('Coba lagi'))
    // Catatan wajib untuk Coba lagi.
    await u.click(screen.getByRole('button', { name: 'Simpan dan lembar berikutnya' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('catatan')
    expect(calls.some((c) => c.method === 'POST')).toBe(false)

    await u.type(screen.getByLabelText(/Catatan untuk anak/), 'Kalimat keduanya masih bilang senang.')
    await u.click(screen.getByLabelText(/Perak/))
    await u.click(screen.getByRole('button', { name: 'Simpan dan lembar berikutnya' }))
    await waitFor(() => expect(screen.getByTestId('lokasi')).toHaveTextContent('/ortu/lembar/6'))
    const post = calls.find((c) => c.method === 'POST')!
    expect(post.body).toEqual({ status: 'coba_lagi', catatan: 'Kalimat keduanya masih bilang senang.', stiker: 'perak' })
    expect(await screen.findByRole('heading', { name: /M4-4/ })).toBeInTheDocument()
    // Hasil lembar sebelumnya tetap terlihat di lembar berikutnya.
    expect(screen.getByText('Lembar M4-3 tersimpan.')).toBeInTheDocument()
  })

  it('Daftar naskah: naskah yang minta stempel ada di atas dengan tandanya', async () => {
    const ringkas = (id: number, judul: string, diminta: string) => ({
      id, judul, tahap: 'revisi', tahap_label: 'Revisi', laci: null, stempel: ['peta'], nomor_terbitan: '',
      stempel_diminta: diminta, created_at: '2026-10-01T00:00:00Z',
    })
    pasangFetch({
      'GET /api/penerbit/me/': { body: ME_ORTU },
      'GET /api/penerbit/ortu/naskah/': { body: [ringkas(1, 'Layang-layang', ''), ringkas(2, 'Sandal Jepit', 'kamera')] },
    })
    tampilHalaman('/ortu/naskah', { '/ortu/naskah': <DaftarNaskah /> })
    const baris = await screen.findAllByRole('row')
    expect(baris[1]).toHaveTextContent('Sandal Jepit')
    expect(within(baris[1]).getByText('minta stempel Kamera')).toBeInTheDocument()
  })

  it('Orang tua yang anaknya belum aktif diarahkan ke Dasbor, bukan melihat galat server', async () => {
    const calls = pasangFetch({
      'GET /api/penerbit/me/': { body: { ...ME_ORTU, peran: [], pemeriksa: [], bisa_diaktifkan: [{ child_id: 7, nama: 'Fatih' }] } },
    })
    tampilHalaman('/ortu/lembar', { '/ortu/lembar': <DaftarLembar /> })
    expect(await screen.findByRole('link', { name: /Aktifkan Penerbit Rumah untuk anak di Dasbor/ })).toHaveAttribute('href', '/ortu')
    expect(calls.some((c) => c.url.includes('/ortu/lembar/'))).toBe(false)
  })

  it('Naskah: Terbitkan terkunci sampai 5 stempel, lalu menampilkan nomor terbitan', async () => {
    const stempel = (punya: number) => ['peta', 'kamera', 'gunting', 'kaca', 'pembaca'].map((lapis, i) => ({
      lapis, nama: lapis[0].toUpperCase() + lapis.slice(1), punya: i < punya, tanggal: i < punya ? '2026-10-10T00:00:00Z' : null, catatan: '',
    }))
    let jumlah = 4
    let terbit = false
    const naskah = () => ({
      body: {
        id: 9, judul: 'Sandal Jepit yang Hilang', tahap: terbit ? 'terbit' : 'revisi', tahap_label: 'Revisi', laci: null,
        nomor_terbitan: terbit ? 'PR-001' : '', created_at: '2026-10-01T00:00:00Z', peta: {}, kartu_tebakan: '',
        stempel: stempel(jumlah), stempel_diminta: jumlah < 5 ? 'pembaca' : '', lapis_berikutnya: null, versi: [],
        jumlah_kata_v1: 210, draf: null, catatan: [], paragraf_favorit: {}, sampul: null, tentang_penulis: '',
        ulasan: [{ favorit: 'a', membingungkan: 'b', pertanyaan: 'c', versi: 3, oleh: 'Babah', tanggal: '2026-10-11T00:00:00Z' }],
        versi_terakhir: { nomor: 3, teks: 'Fatih punya sandal jepit hijau.\nRak sandalnya kosong.', isi: {}, sorotan: [], lapis: 'kamera' },
        dibagikan: [], jejak: { kesalahan_ejaan: 4, kesalahan_ejaan_ortu: null },
      },
    })
    const calls = pasangFetch({
      'GET /api/penerbit/me/': { body: ME_ORTU },
      'GET /api/penerbit/ortu/naskah/9/': naskah,
      'POST /api/penerbit/ortu/naskah/9/stempel/': () => { jumlah = 5; return { status: 201, body: { stempel: stempel(5) } } },
      'POST /api/penerbit/ortu/naskah/9/terbitkan/': () => { terbit = true; return { body: { nomor_terbitan: 'PR-001', hadiah_baru: [] } } },
    })
    tampilHalaman('/ortu/naskah/9', { '/ortu/naskah/:id': <NaskahPenulis /> })
    expect(await screen.findByText('Rak sandalnya kosong.')).toBeInTheDocument()
    // Teks naskah hanya bisa dibaca.
    expect(screen.queryByRole('textbox', { name: /Versi terakhir/ })).toBeNull()
    const u = userEvent.setup()
    expect(screen.getByRole('button', { name: /^Terbitkan/ })).toBeDisabled()
    await u.click(screen.getByRole('button', { name: 'Beri stempel Pembaca' }))
    await waitFor(() => expect(screen.getByRole('button', { name: /^Terbitkan/ })).toBeEnabled())
    expect(calls.find((c) => c.url.endsWith('/stempel/'))?.body).toMatchObject({ lapis: 'pembaca' })

    await u.type(screen.getByLabelText('Tentang Penulis'), 'Fatih, 10 tahun, suka kucing.')
    await u.click(screen.getByRole('button', { name: /^Terbitkan/ }))
    expect(await screen.findByText(/Terbit sebagai PR-001/)).toBeInTheDocument()
    const fd = calls.find((c) => c.url.endsWith('/terbitkan/'))!.body as FormData
    expect(fd.get('tentang_penulis')).toBe('Fatih, 10 tahun, suka kucing.')
    expect(screen.getByRole('link', { name: 'Lihat di Rak Buku' })).toHaveAttribute('href', '/rak/9')
  })

  it('Cetak per modul: lembar yang dipilih dicetak satu per halaman beserta Kartu Alat', async () => {
    const print = vi.fn()
    vi.stubGlobal('print', print)
    pasangFetch({
      'GET /api/penerbit/me/': { body: ME_ORTU },
      'GET /api/penerbit/ortu/cetak/': {
        body: { modul: { nomor: 4, judul: 'Kamera' }, lembar: [LEMBAR, { ...LEMBAR, kode: 'M4-4', judul: 'Lembar empat' }] },
      },
      'GET /api/penerbit/ortu/stiker/': {
        body: { alat: [{ kode: 'kamera', nama: 'Kamera', emoji: '🎥', pertanyaan: 'Apa yang terlihat?', slot: [] }], stempel: [] },
      },
    })
    tampilHalaman('/ortu/cetak?modul=4', { '/ortu/cetak': <CetakModul /> })
    const u = userEvent.setup()
    await u.click(await screen.findByRole('checkbox', { name: /M4-4/ }))
    await u.click(screen.getByRole('checkbox', { name: /Kartu Alat/ }))
    await u.click(screen.getByRole('button', { name: /Cetak yang dipilih \(2\)/ }))
    await waitFor(() => expect(print).toHaveBeenCalled())
    const area = screen.getByLabelText('Pratinjau cetak')
    expect(within(area).getByLabelText('Lembar M4-3')).toBeInTheDocument()
    expect(within(area).queryByLabelText('Lembar M4-4')).toBeNull()
    expect(within(area).getByLabelText('Kartu Alat')).toHaveTextContent('Kamera')
  })

  it('Hadiah: menyetujui penukaran yang diajukan', async () => {
    let status = 'diajukan'
    const calls = pasangFetch({
      'GET /api/penerbit/me/': { body: ME_ORTU },
      'GET /api/penerbit/ortu/hadiah/': () => ({
        body: {
          total: 80, hadiah: [{ id: 1, nama: 'Es krim', harga: 50, aktif: true }],
          penukaran: [{ id: 3, hadiah: 'Es krim', harga: 50, status, tanggal: '2026-10-20T00:00:00Z' }],
          riwayat_poin: [{ minggu: '2026-W43', total: 30, baris: [{ jumlah: 30, alasan: 'Misi 3.1', tanggal: '2026-10-20T00:00:00Z' }] }],
        },
      }),
      'POST /api/penerbit/ortu/penukaran/3/': () => { status = 'disetujui'; return { body: {} } },
    })
    tampilHalaman('/ortu/hadiah', { '/ortu/hadiah': <HadiahPoin /> })
    await userEvent.click(await screen.findByRole('button', { name: 'Setujui' }))
    expect(await screen.findByText(/Sudah disetujui: Es krim/)).toBeInTheDocument()
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ status: 'disetujui' })
    expect(screen.getByText('Misi 3.1')).toBeInTheDocument()
    // Kode minggu ISO dari server ditampilkan sebagai rentang tanggal.
    expect(screen.getByText('Minggu 19–25 Okt')).toBeInTheDocument()
  })

  it('Prompt anak: menandai bagian Rumus Bertanya dan menyimpan catatan orang tua', async () => {
    const calls = pasangFetch({
      'GET /api/penerbit/me/': { body: ME_ORTU },
      'GET /api/penerbit/ortu/prompt/': {
        body: [{ id: 2, modul: 12, tahap: 'isian', bagian: ['Aku sedang revisi', '', 'Tolong beri 2 pertanyaan', ''],
          teks: 'Aku sedang revisi. Tolong beri 2 pertanyaan.', refleksi_bantu: 'sedikit', refleksi_ubah: 'kalimat 2',
          catatan_ortu: '', tanggal: '2026-10-20T00:00:00Z' }],
      },
      'PATCH /api/penerbit/ortu/prompt/2/': (_u, init) => ({ body: { id: 2, catatan_ortu: JSON.parse(String(init.body)).catatan_ortu } }),
    })
    tampilHalaman('/ortu/prompt', { '/ortu/prompt': <PromptAnak /> })
    expect(await screen.findByText('Isian')).toBeInTheDocument()
    expect(screen.getAllByText('kosong')).toHaveLength(2)
    expect(screen.getByText('Sedikit')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Catatan orang tua'), 'Tanyakan kalimat 2')
    await userEvent.click(screen.getByRole('button', { name: 'Simpan catatan' }))
    expect(await screen.findByText('Tersimpan')).toBeInTheDocument()
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ catatan_ortu: 'Tanyakan kalimat 2' })
  })
})
