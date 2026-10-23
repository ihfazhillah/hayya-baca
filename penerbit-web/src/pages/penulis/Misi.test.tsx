import { act, render, screen, within } from '@testing-library/react'
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
    expect(screen.getByText(/Misi 2 dari 3/)).toBeInTheDocument()
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

  it('misi di luar layar: alasan, langkah bernomor, contoh jawaban, dan tujuan untuk orang tua', async () => {
    pasangFetch({
      'GET /api/penerbit/modul/1/': { body: MODUL },
      'GET /api/penerbit/misi/12/': {
        body: {
          ...dasarMisi, id: 12, urutan: 3, berikutnya: null, judul: 'Buku favoritmu', jenis: 'log',
          tahap: 'dunia_nyata', tahap_label: 'Dunia nyata', pertanyaan: 'Apakah kamu tersandung?',
          kenapa: 'Pengeras Suara bisa dipakai di buku apa saja.',
          langkah: ['Taruh tablet sebentar.', 'Ambil satu buku.', 'Kembali ke sini.'],
          contoh: 'Aku tersandung di halaman 12.',
          petunjuk_ortu: 'Tujuannya: memakai alat di luar latihan.',
        },
      },
    })
    tampil('/modul/1/misi/3')
    expect(await screen.findByText('Pengeras Suara bisa dipakai di buku apa saja.')).toBeInTheDocument()
    const langkah = screen.getByRole('list', { name: 'Langkah' })
    expect(langkah.tagName).toBe('OL')
    expect(langkah).toHaveTextContent('Taruh tablet sebentar.')
    expect(screen.getByText(/Aku tersandung di halaman 12\./)).toBeInTheDocument()
    expect(screen.getByText('Tujuannya: memakai alat di luar latihan.')).toBeInTheDocument()
  })

  it('misi bonus ditandai boleh dilewati', async () => {
    pasangFetch({
      'GET /api/penerbit/modul/1/': { body: MODUL },
      'GET /api/penerbit/misi/10/': {
        body: { ...dasarMisi, id: 10, urutan: 1, berikutnya: 11, judul: 'Bonus', jenis: 'tandai', tahap: 'bonus', tahap_label: 'Bonus' },
      },
    })
    tampil('/modul/1/misi/1')
    expect(await screen.findByText(/boleh dilewati/)).toBeInTheDocument()
  })

  it('misi rekam: belum ada teks sebelum misi lain selesai', async () => {
    pasangFetch({
      'GET /api/penerbit/modul/1/': { body: MODUL },
      'GET /api/penerbit/misi/10/': {
        body: { ...dasarMisi, id: 10, urutan: 1, berikutnya: 11, judul: 'Rekam suaramu', jenis: 'tandai', tahap: 'bonus', tahap_label: 'Bonus', teks_rekam: [] },
      },
    })
    tampil('/modul/1/misi/1')
    expect(await screen.findByText(/Selesaikan dulu misi Si Ceroboh/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Rekam/ })).not.toBeInTheDocument()
  })

  it('misi rekam: rekam, berhenti, lalu dengarkan rekamannya di halaman ini', async () => {
    class PerekamPalsu {
      state = 'inactive'
      ondataavailable: ((e: { data: Blob }) => void) | null = null
      onstop: (() => void) | null = null
      start() { this.state = 'recording' }
      stop() {
        this.state = 'inactive'
        this.ondataavailable?.({ data: new Blob(['suara'], { type: 'audio/webm' }) })
        this.onstop?.()
      }
    }
    const berhentiTrek = vi.fn()
    vi.stubGlobal('MediaRecorder', PerekamPalsu)
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: berhentiTrek }] }) },
    })
    URL.createObjectURL = vi.fn(() => 'blob:rekaman')
    URL.revokeObjectURL = vi.fn()
    pasangFetch({
      'GET /api/penerbit/modul/1/': { body: MODUL },
      'GET /api/penerbit/misi/10/': {
        body: {
          ...dasarMisi, id: 10, urutan: 1, berikutnya: 11, judul: 'Rekam suaramu', jenis: 'tandai', tahap: 'bonus', tahap_label: 'Bonus',
          teks_rekam: [{ judul: 'Oren dan ikan', teks: 'Oren sangat suka makan ikan.' }],
        },
      },
    })
    tampil('/modul/1/misi/1')
    expect(await screen.findByText('Oren sangat suka makan ikan.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Rekam/ }))
    await userEvent.click(await screen.findByRole('button', { name: /Berhenti/ }))
    expect(berhentiTrek).toHaveBeenCalled()
    expect(await screen.findByLabelText('Rekamanmu')).toHaveAttribute('src', 'blob:rekaman')
    expect(screen.getByRole('button', { name: 'Tandai selesai' })).toBeInTheDocument()
  })

  it('deretan misi: bisa lompat ke misi lain dan kembali ke modul', async () => {
    pasangFetch({
      'GET /api/penerbit/modul/1/': { body: { ...MODUL, misi: [{ ...misiRingkas(10, 1, 'tandai'), status: 'selesai' }, misiRingkas(11, 2), misiRingkas(12, 3, 'cetak')] } },
      'GET /api/penerbit/misi/11/': {
        body: { ...dasarMisi, id: 11, urutan: 2, berikutnya: 12, judul: 'Klik', jenis: 'klik', tokens: tokens('Oren.'), jumlah: 1 },
      },
    })
    tampil('/modul/1/misi/2')
    const deret = await screen.findByRole('navigation', { name: 'Misi di modul ini' })
    expect(within(deret).getByRole('link', { name: /Misi 1.*selesai/ })).toHaveAttribute('href', '/modul/1/misi/1')
    expect(within(deret).getByRole('link', { name: /Misi 2/ })).toHaveAttribute('aria-current', 'step')
    expect(within(deret).getByRole('link', { name: /Misi 3/ })).toHaveAttribute('href', '/modul/1/misi/3')
    expect(screen.getByRole('link', { name: /Kembali ke Modul 1/ })).toHaveAttribute('href', '/modul/1')
  })

  it('misi rekam yang sudah selesai tetap menampilkan teks dan perekam', async () => {
    pasangFetch({
      'GET /api/penerbit/modul/1/': { body: MODUL },
      'GET /api/penerbit/misi/10/': {
        body: {
          ...dasarMisi, id: 10, urutan: 1, berikutnya: 11, judul: 'Rekam suaramu', jenis: 'tandai', tahap: 'bonus', tahap_label: 'Bonus',
          status: 'selesai', teks_rekam: [{ judul: 'Oren dan ikan', teks: 'Oren sangat suka makan ikan.' }],
        },
      },
    })
    tampil('/modul/1/misi/1')
    expect(await screen.findByText('Oren sangat suka makan ikan.')).toBeInTheDocument()
    expect(screen.getByText(/sudah selesai/)).toBeInTheDocument()
  })

  it('misi rekam di perangkat tanpa perekam: arahkan ke aplikasi perekam tablet', async () => {
    vi.stubGlobal('MediaRecorder', undefined)
    pasangFetch({
      'GET /api/penerbit/modul/1/': { body: MODUL },
      'GET /api/penerbit/misi/10/': {
        body: {
          ...dasarMisi, id: 10, urutan: 1, berikutnya: 11, judul: 'Rekam suaramu', jenis: 'tandai', tahap: 'bonus', tahap_label: 'Bonus',
          teks_rekam: [{ judul: 'Oren dan ikan', teks: 'Oren sangat suka makan ikan.' }],
        },
      },
    })
    tampil('/modul/1/misi/1')
    expect(await screen.findByText(/aplikasi perekam suara/)).toBeInTheDocument()
  })
})

describe('Misi: Contoh dari Oren, bantuan memudar, dan suara (spec 075 K1)', () => {
  // "Hujan deras sekali sekali. Oren di di rumah. Dia tapi tapi tidur."
  // sekali = 4, 6 · kalimat 2 = 9..16 · di = 11, 13 · tapi = 22, 24
  const TEKS = 'Hujan deras sekali sekali. Oren di di rumah. Dia tapi tapi tidur.'
  const misiContoh = {
    ...dasarMisi, id: 10, urutan: 1, berikutnya: 11, judul: 'Oren tersandung', jenis: 'klik',
    tahap: 'bersama', tahap_label: 'Contoh dari Oren', tokens: tokens(TEKS),
    percobaan: { diklik: [], meleset: 0, ditemukan: 0, pakai_petunjuk: false },
    contoh: [
      { sorot: [4, 5, 6], pikir: 'Eh, lidahku tersandung di sini!' },
      { sorot: [], pikir: 'Sekarang giliranmu.' },
    ],
    bantuan_memudar: true,
    bantuan: { tingkat: 'tunjuk', token: [4, 5, 6], celah: null, alasan: 'Kata "sekali" ada dua.' },
  }
  const klikJawab = (bantuan: unknown, ditemukan: number) => ({
    body: { hasil: 'ketemu', ditemukan, total: 3, meleset: 0, boleh_petunjuk: false, selesai: false, bantuan },
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('contoh langkah demi langkah, lalu giliranmu: bantuan ditunjukkan, lalu letaknya, lalu sendiri', async () => {
    let n = 0
    pasangFetch({
      'GET /api/penerbit/modul/1/': { body: MODUL },
      'GET /api/penerbit/misi/10/': { body: misiContoh },
      'POST /api/penerbit/misi/10/klik/': () => (++n === 1
        ? klikJawab({ tingkat: 'letak', kalimat: [9, 16] }, 1)
        : klikJawab(null, 2)),
    })
    tampil('/modul/1/misi/1')
    expect(await screen.findByText('🔊 Pengeras Suara · Contoh dari Oren')).toBeInTheDocument()
    const contoh = screen.getByRole('region', { name: 'Contoh dari Oren' })
    expect(within(contoh).getByText('Eh, lidahku tersandung di sini!')).toBeInTheDocument()
    expect(within(contoh).getByText('Langkah 1 dari 2')).toBeInTheDocument()
    expect(within(contoh).getAllByText('sekali').every((el) => el.classList.contains('sorot-oren'))).toBe(true)
    expect(within(contoh).getByText('Hujan')).not.toHaveClass('sorot-oren')
    // Selama contoh, kata belum bisa diklik.
    expect(screen.queryByRole('button', { name: 'sekali' })).toBeNull()

    await userEvent.click(within(contoh).getByRole('button', { name: 'Lanjut' }))
    expect(within(contoh).getByText('Sekarang giliranmu.')).toBeInTheDocument()
    await userEvent.click(within(contoh).getByRole('button', { name: 'Giliranku!' }))
    expect(screen.queryByRole('region', { name: 'Contoh dari Oren' })).toBeNull()

    // Bantuan 1: kesalahan pertama ditunjukkan dan dijelaskan.
    const bantuan = screen.getByRole('note', { name: 'Bantuan Oren' })
    expect(bantuan).toHaveTextContent('Kata "sekali" ada dua.')
    screen.getAllByRole('button', { name: 'sekali' }).forEach((b) => expect(b).toHaveClass('bantuan-tunjuk'))

    // Bantuan 2: hanya kalimatnya.
    await userEvent.click(screen.getAllByRole('button', { name: 'sekali' })[0])
    expect(await screen.findByText(/kalimat yang kuning/)).toBeInTheDocument()
    screen.getAllByRole('button', { name: 'di' }).forEach((b) => expect(b).toHaveClass('kalimat-petunjuk'))
    expect(screen.getAllByRole('button', { name: 'di' })[0]).not.toHaveClass('bantuan-tunjuk')
    expect(screen.getAllByRole('button', { name: 'tapi' })[0]).not.toHaveClass('kalimat-petunjuk')

    // Sisanya dicari sendiri.
    await userEvent.click(screen.getAllByRole('button', { name: 'di' })[0])
    expect(await screen.findByText(/Sekarang cari sendiri/)).toBeInTheDocument()
    expect(document.querySelector('.kalimat-petunjuk, .bantuan-tunjuk')).toBeNull()
  })

  it('contoh dilewati bila anak sudah mulai mencari', async () => {
    pasangFetch({
      'GET /api/penerbit/modul/1/': { body: MODUL },
      'GET /api/penerbit/misi/10/': {
        body: {
          ...misiContoh, percobaan: { diklik: [4], meleset: 0, ditemukan: 1, pakai_petunjuk: false },
          bantuan: { tingkat: 'letak', kalimat: [9, 16] },
        },
      },
    })
    tampil('/modul/1/misi/1')
    expect(await screen.findByText(/kalimat yang kuning/)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Contoh dari Oren' })).toBeNull()
    expect(screen.getByRole('button', { name: /Lihat contoh Oren lagi/ })).toBeInTheDocument()
  })

  function pasangSuara(suara: { lang: string; name: string }[]) {
    const diucapkan: { text: string; lang: string; voice: unknown; onend: (() => void) | null }[] = []
    class Ucapan {
      lang = ''
      voice: unknown = null
      onend: (() => void) | null = null
      onerror: (() => void) | null = null
      text: string
      constructor(text: string) { this.text = text }
    }
    vi.stubGlobal('SpeechSynthesisUtterance', Ucapan)
    vi.stubGlobal('speechSynthesis', {
      getVoices: () => suara,
      speak: vi.fn((u: (typeof diucapkan)[number]) => { diucapkan.push(u) }),
      cancel: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    return diucapkan
  }
  const misiSuara = {
    ...dasarMisi, id: 11, urutan: 2, berikutnya: 12, judul: 'Oren dan ikan', jenis: 'klik', suara: true,
    tokens: tokens('Oren di di dapur.'), jumlah: 1, percobaan: { diklik: [], meleset: 0, pakai_petunjuk: false },
  }

  it('tombol 🔊 membacakan teks dengan suara Indonesia; "dengarkan dulu" menyembunyikan teks sampai selesai', async () => {
    const diucapkan = pasangSuara([{ lang: 'en-US', name: 'Samantha' }, { lang: 'id-ID', name: 'Damayanti' }])
    pasangFetch({ 'GET /api/penerbit/modul/1/': { body: MODUL }, 'GET /api/penerbit/misi/11/': { body: misiSuara } })
    tampil('/modul/1/misi/2')
    await userEvent.click(await screen.findByRole('button', { name: /🔊 Dengarkan/ }))
    expect(diucapkan[0].text).toBe('Oren di di dapur.')
    expect(diucapkan[0].lang).toBe('id-ID')
    expect(diucapkan[0].voice).toEqual({ lang: 'id-ID', name: 'Damayanti' })

    await userEvent.click(screen.getByRole('checkbox', { name: 'Dengarkan dulu, lalu teksnya muncul' }))
    expect(screen.queryByRole('button', { name: 'di' })).toBeNull()
    expect(screen.getByText(/Teksnya muncul setelah kamu mendengarnya/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /🔊 Dengarkan/ }))
    expect(screen.queryByRole('button', { name: 'di' })).toBeNull()
    act(() => diucapkan[1].onend?.())
    expect(screen.getAllByRole('button', { name: 'di' })).toHaveLength(2)
  })

  it('tanpa suara Indonesia atau tanpa speechSynthesis: tombol 🔊 tidak ada, teks langsung tampil', async () => {
    localStorage.setItem('penerbit-dengar-dulu', '1')
    pasangSuara([{ lang: 'en-US', name: 'Samantha' }])
    pasangFetch({ 'GET /api/penerbit/modul/1/': { body: MODUL }, 'GET /api/penerbit/misi/11/': { body: misiSuara } })
    const { unmount } = tampil('/modul/1/misi/2')
    expect(await screen.findAllByRole('button', { name: 'di' })).toHaveLength(2)
    expect(screen.queryByRole('button', { name: /🔊 Dengarkan/ })).toBeNull()
    unmount()

    vi.unstubAllGlobals()
    pasangFetch({ 'GET /api/penerbit/modul/1/': { body: MODUL }, 'GET /api/penerbit/misi/11/': { body: misiSuara } })
    tampil('/modul/1/misi/2')
    expect(await screen.findAllByRole('button', { name: 'di' })).toHaveLength(2)
    expect(screen.queryByRole('button', { name: /🔊 Dengarkan/ })).toBeNull()
  })
})
