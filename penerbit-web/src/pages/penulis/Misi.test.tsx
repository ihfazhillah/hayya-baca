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

  it('misi yang sudah selesai: contoh Oren bisa dilihat lagi dan misinya dikerjakan lagi', async () => {
    pasangFetch({
      'GET /api/penerbit/modul/1/': { body: MODUL },
      'GET /api/penerbit/misi/10/': {
        body: { ...misiContoh, status: 'selesai', percobaan: undefined, bantuan: null, versi_benar: 'Hujan deras sekali.' },
      },
    })
    tampil('/modul/1/misi/1')
    expect(await screen.findByText('Hujan deras sekali.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Lihat contoh Oren lagi/ }))
    const contoh = screen.getByRole('region', { name: 'Contoh dari Oren' })
    expect(within(contoh).getByText('Eh, lidahku tersandung di sini!')).toBeInTheDocument()
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

describe('Misi: Kamera, pilih perasaan lalu klik bukti (spec 075 K1 Fase B)', () => {
  // Oren0 _ pulang2 .3 _ Bahunya5 _ turun7 .8 (pola sama untuk ketiga teks)
  const T0 = tokens('Oren pulang. Bahunya turun.')
  const T1 = tokens('Ibu masuk. Tangannya mengepal.')
  const T2 = tokens('Adik duduk. Dia menguap.')
  const misiPerasaan = {
    ...dasarMisi, modul: { nomor: 1, judul: 'Kamera', alat: 'kamera' },
    id: 10, urutan: 1, berikutnya: 11, judul: 'Oren menebak perasaan', jenis: 'perasaan',
    tahap: 'bersama', tahap_label: 'Contoh dari Oren',
    contoh: [
      { sorot: [5, 6, 7], pikir: 'Bahunya turun. Badannya lemas.', pilih: null },
      { sorot: [], pikir: 'Aku pilih sedih.', pilih: 'sedih' },
    ],
    soal: [
      { tokens: T0, pilihan: ['senang', 'sedih'], jumlah_bukti: 1, contoh: true, jawaban: 'sedih', bukti: [[5, 7]], alasan: 'Itu sedih.' },
      { tokens: T1, pilihan: ['senang', 'marah'], jumlah_bukti: 1 },
      { tokens: T2, pilihan: ['ngantuk', 'marah'], jumlah_bukti: 1 },
    ],
    bantuan_memudar: true,
    bantuan: { tingkat: 'tunjuk', soal: 1, token: [5, 7] },
    percobaan: { soal: 1, perasaan: null, diklik: [], ditemukan: 0, meleset: 0, selesai_soal: [] },
  }
  const jawab = (body: object) => ({ body: { hasil: 'benar', soal: 1, ditemukan: 0, total: 1, meleset: 0, butir_selesai: false, selesai: false, ...body } })

  it('contoh Oren memilih perasaan, lalu giliranmu: pilih, klik bukti, alasan, soal berikutnya, selesai', async () => {
    const kirim: unknown[] = []
    const balasan = [
      jawab({ hasil: 'belum', meleset: 1, bantuan: { tingkat: 'tunjuk', soal: 1, token: [5, 7] } }),
      jawab({ hasil: 'benar', meleset: 1, bantuan: { tingkat: 'tunjuk', soal: 1, token: [5, 7] } }),
      jawab({
        hasil: 'ketemu', soal: 2, ditemukan: 1, butir_selesai: true, jawaban: 'marah', bukti: [[5, 7]],
        alasan: 'Tangan mengepal. Itu marah.', bantuan: { tingkat: 'letak', soal: 2, kalimat: [5, 8] },
      }),
      jawab({ hasil: 'benar', soal: 2, bantuan: { tingkat: 'letak', soal: 2, kalimat: [5, 8] } }),
      jawab({
        hasil: 'ketemu', soal: null, ditemukan: 1, butir_selesai: true, jawaban: 'ngantuk', bukti: [[7]],
        alasan: 'Menguap. Itu ngantuk.', bantuan: null, selesai: true, hadiah_baru: [],
        soal_jawaban: [{ jawaban: 'sedih' }, { jawaban: 'marah' }, { jawaban: 'ngantuk' }],
      }),
    ]
    pasangFetch({
      'GET /api/penerbit/modul/1/': { body: MODUL },
      'GET /api/penerbit/misi/10/': { body: misiPerasaan },
      'POST /api/penerbit/misi/10/perasaan/': (_url, init) => {
        kirim.push(JSON.parse(String(init.body)))
        return balasan.shift()!
      },
    })
    tampil('/modul/1/misi/1')
    const contoh = await screen.findByRole('region', { name: 'Contoh dari Oren' })
    expect(within(contoh).getByText('Bahunya')).toHaveClass('sorot-oren')
    await userEvent.click(within(contoh).getByRole('button', { name: 'Lanjut' }))
    expect(within(contoh).getByText('Aku pilih sedih.')).toBeInTheDocument()
    expect(within(contoh).getByText('sedih')).toHaveClass('pilihan-oren')
    await userEvent.click(within(contoh).getByRole('button', { name: 'Giliranku!' }))

    // Soal 1 (anak): bukti ditunjukkan, perasaan ditebak sendiri. Kata belum bisa diklik.
    expect(screen.getByText('Soal 1 dari 2')).toBeInTheDocument()
    expect(screen.getByRole('note', { name: 'Bantuan Oren' })).toHaveTextContent('Lihat kata yang bersinar')
    expect(screen.getByText('Tangannya')).toHaveClass('bantuan-tunjuk')
    expect(screen.queryByRole('button', { name: 'Tangannya' })).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'senang' }))
    expect(kirim[0]).toEqual({ soal: 1, perasaan: 'senang' })
    expect(await screen.findByText(/Belum tepat/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'marah' }))
    expect(await screen.findByText(/klik kata yang membuatmu tahu/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'marah' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('0 dari 1 bukti ditemukan')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Tangannya' }))
    expect(kirim[2]).toEqual({ soal: 1, token: 5 })
    expect(await screen.findByText('Tangan mengepal. Itu marah.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Soal berikutnya' }))

    // Soal 2: hanya kalimatnya yang diberi tahu.
    expect(screen.getByText('Soal 2 dari 2')).toBeInTheDocument()
    expect(screen.getByText('menguap')).toHaveClass('kalimat-petunjuk')
    expect(screen.getByText('Adik')).not.toHaveClass('kalimat-petunjuk')
    await userEvent.click(screen.getByRole('button', { name: 'ngantuk' }))
    await userEvent.click(await screen.findByRole('button', { name: 'menguap' }))
    expect(await screen.findByRole('heading', { name: 'Misi 1 selesai!' })).toBeInTheDocument()
    expect(screen.getByText('Menguap. Itu ngantuk.')).toBeInTheDocument()
  })

  it('dilanjutkan setelah dimuat ulang: contoh dilewati, perasaan yang sudah dipilih tetap', async () => {
    pasangFetch({
      'GET /api/penerbit/modul/1/': { body: MODUL },
      'GET /api/penerbit/misi/10/': {
        body: {
          ...misiPerasaan, bantuan: null,
          percobaan: { soal: 2, perasaan: 'ngantuk', diklik: [], ditemukan: 0, meleset: 0, selesai_soal: [] },
        },
      },
    })
    tampil('/modul/1/misi/1')
    expect(await screen.findByText('Soal 2 dari 2')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Contoh dari Oren' })).toBeNull()
    expect(screen.getByRole('button', { name: 'ngantuk' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'menguap' })).toBeInTheDocument()
    expect(screen.getByRole('note', { name: 'Bantuan Oren' })).toHaveTextContent('cari sendiri')
  })

  it('misi yang sudah selesai: jawaban tiap soal, contoh Oren dan Kerjakan lagi', async () => {
    pasangFetch({
      'GET /api/penerbit/modul/1/': { body: MODUL },
      'GET /api/penerbit/misi/10/': {
        body: {
          ...misiPerasaan, status: 'selesai', bantuan: undefined,
          soal_jawaban: [
            { jawaban: 'sedih', bukti: [[5, 7]], alasan: 'Itu sedih.' },
            { jawaban: 'marah', bukti: [[5, 7]], alasan: 'Tangan mengepal. Itu marah.' },
            { jawaban: 'ngantuk', bukti: [[7]], alasan: 'Menguap. Itu ngantuk.' },
          ],
        },
      },
    })
    tampil('/modul/1/misi/1')
    expect(await screen.findByText('Tangan mengepal. Itu marah.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Lihat contoh Oren lagi/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Kerjakan lagi/ }))
    expect(screen.getByRole('region', { name: 'Contoh dari Oren' })).toBeInTheDocument()
  })
})

describe('Misi: Gunting dan Detektor Kembar dengan Contoh dari Oren (spec 075 Fase B)', () => {
  // "Oren lari dan dia lompat dan dia jatuh." spasi: 1 3 5 7 9 11 13 · potong 1 = [3, 5], potong 2 = [9, 11]
  const TEKS_GUNTING = 'Oren lari dan dia lompat dan dia jatuh.'
  const MODUL_2 = {
    ...MODUL, nomor: 2, judul: 'Gunting', alat: { ...ALAT, kode: 'gunting', nama: 'Gunting', emoji: '✂️' },
    misi: [misiRingkas(20, 1, 'gunting'), misiRingkas(21, 2, 'gunting')],
  }
  const misiGunting = {
    ...dasarMisi, modul: { nomor: 2, judul: 'Gunting', alat: 'gunting' }, jumlah_misi: 2,
    id: 20, urutan: 1, berikutnya: 21, judul: 'Titik!', jenis: 'gunting', tahap: 'bersama',
    tahap_label: 'Contoh dari Oren', suara: true, tokens: tokens(TEKS_GUNTING),
    percobaan: { diklik: [], meleset: 0, ditemukan: 0, pakai_petunjuk: false },
    contoh: [
      { sorot: [0, 1, 2, 3, 4], pikir: 'Aku baca dalam satu napas.' },
      { sorot: [3], pikir: 'Aku potong di sini.' },
      { sorot: [], pikir: 'Sekarang giliranmu!' },
    ],
    bantuan_memudar: true,
    bantuan: { tingkat: 'tunjuk', token: [3, 5], celah: null, alasan: 'Potong di dekat kata "dan".' },
  }
  const garis = () => screen.getAllByRole('button', { name: 'pasang garis potong di sini' })

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('gunting: contoh Oren menyorot celah potongnya, lalu potongan pertama ditunjukkan, kedua bagiannya, sisanya sendiri', async () => {
    const calls = pasangFetch({
      'GET /api/penerbit/modul/2/': { body: MODUL_2 },
      'GET /api/penerbit/misi/20/': { body: misiGunting },
      'POST /api/penerbit/misi/20/bantuan/': (_url, init) => {
        const { potong } = JSON.parse(String(init.body)) as { potong: number[] }
        return { body: { bantuan: potong.includes(9) ? null : { tingkat: 'letak', kalimat: [6, 14] } } }
      },
      'POST /api/penerbit/misi/20/periksa/': {
        body: {
          tepat: [3, 9], tidak_perlu: [], kurang: 0, benar: 2, total: 2, selesai: true, hadiah_baru: [],
          potong: [[3, 5], [9, 11]], versi_benar: 'Oren lari. Dia lompat. Dia jatuh.',
        },
      },
    })
    tampil('/modul/2/misi/1')
    expect(await screen.findByText('✂️ Gunting · Contoh dari Oren')).toBeInTheDocument()
    const contoh = screen.getByRole('region', { name: 'Contoh dari Oren' })
    expect(within(contoh).getByText('Aku baca dalam satu napas.')).toBeInTheDocument()
    expect(screen.queryAllByRole('button', { name: 'pasang garis potong di sini' })).toHaveLength(0)
    await userEvent.click(within(contoh).getByRole('button', { name: 'Lanjut' }))
    // Langkah 2: hanya celah tempat Oren memotong yang disorot.
    expect(within(contoh).getAllByLabelText('Oren memotong di sini')).toHaveLength(1)
    await userEvent.click(within(contoh).getByRole('button', { name: 'Lanjut' }))
    await userEvent.click(within(contoh).getByRole('button', { name: 'Giliranku!' }))
    expect(screen.queryByRole('region', { name: 'Contoh dari Oren' })).toBeNull()

    // Bantuan 1: potongan pertama ditunjukkan dengan alasannya.
    expect(screen.getByRole('note', { name: 'Bantuan Oren' })).toHaveTextContent('Potong di dekat kata "dan".')
    expect(garis()[1]).toHaveClass('bantuan-tunjuk') // spasi 3
    expect(garis()[2]).toHaveClass('bantuan-tunjuk') // spasi 5
    expect(garis()[4]).not.toHaveClass('bantuan-tunjuk')

    // Bantuan 2: hanya bagian kalimatnya.
    await userEvent.click(garis()[1])
    expect(calls.filter((c) => c.url.endsWith('/bantuan/')).at(-1)?.body).toEqual({ potong: [3] })
    expect(await screen.findByText(/bagian yang kuning/)).toBeInTheDocument()
    expect(garis()[4]).toHaveClass('kalimat-petunjuk') // spasi 9
    expect(screen.getByText('lompat')).toHaveClass('kalimat-petunjuk')
    expect(garis()[1]).not.toHaveClass('bantuan-tunjuk')

    // Sisanya sendiri.
    await userEvent.click(garis()[4])
    expect(await screen.findByText(/Sekarang cari sendiri/)).toBeInTheDocument()
    expect(document.querySelector('.kalimat-petunjuk, .bantuan-tunjuk')).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: 'Periksa' }))
    expect(await screen.findByText('Oren lari. Dia lompat. Dia jatuh.')).toBeInTheDocument()
    expect(calls.find((c) => c.url.endsWith('/periksa/'))?.body).toEqual({ potong: [3, 9] })
    expect(screen.queryByRole('note', { name: 'Bantuan Oren' })).toBeNull()
  })

  it('gunting dengan 🔊: teks dibacakan, garis potong tetap bisa dipasang', async () => {
    const diucapkan: { text: string }[] = []
    vi.stubGlobal('SpeechSynthesisUtterance', class { lang = ''; voice = null; onend = null; onerror = null; text: string; constructor(text: string) { this.text = text } })
    vi.stubGlobal('speechSynthesis', {
      getVoices: () => [{ lang: 'id-ID', name: 'Damayanti' }],
      speak: (u: { text: string }) => { diucapkan.push(u) },
      cancel: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(),
    })
    pasangFetch({
      'GET /api/penerbit/modul/2/': { body: MODUL_2 },
      'GET /api/penerbit/misi/21/': {
        body: { ...misiGunting, id: 21, urutan: 2, berikutnya: null, tahap: 'petunjuk', tahap_label: 'Dengan petunjuk', contoh: undefined, bantuan_memudar: undefined, bantuan: undefined },
      },
    })
    tampil('/modul/2/misi/2')
    await userEvent.click(await screen.findByRole('button', { name: /🔊 Dengarkan/ }))
    expect(diucapkan[0].text).toBe(TEKS_GUNTING)
    expect(garis()).toHaveLength(7)
    expect(screen.queryByRole('note', { name: 'Bantuan Oren' })).toBeNull()
  })

  // "Terus makan. Terus minum." Terus = 0, 5
  const MODUL_3 = {
    ...MODUL, nomor: 3, judul: 'Detektor Kembar', alat: { ...ALAT, kode: 'kembar', nama: 'Detektor Kembar', emoji: '🔁' },
    misi: [misiRingkas(30, 1, 'kembar'), misiRingkas(31, 2, 'kembar')],
  }
  const misiKembar = {
    ...dasarMisi, modul: { nomor: 3, judul: 'Detektor Kembar', alat: 'kembar' }, jumlah_misi: 2,
    id: 30, urutan: 1, berikutnya: 31, judul: 'Oren makan terus', jenis: 'kembar', tahap: 'bersama',
    tahap_label: 'Contoh dari Oren', tokens: tokens('Terus makan. Terus minum.'), kata_umum: ['dan'],
    percobaan: { diklik: [], meleset: 0, ditemukan: 0, pakai_petunjuk: false },
    contoh: [{ sorot: [0, 5], pikir: 'Kata "terus" muncul lagi.' }, { sorot: [], pikir: 'Sekarang giliranmu.' }],
    bantuan_memudar: true,
    bantuan: { tingkat: 'tunjuk', token: [0, 5], celah: null, alasan: 'Kata "terus" muncul dua kali.' },
  }

  it('kembar: contoh Oren, kata kembar ditunjukkan dengan alasan, versi benar terbuka setelah selesai', async () => {
    pasangFetch({
      'GET /api/penerbit/modul/3/': { body: MODUL_3 },
      'GET /api/penerbit/misi/30/': { body: misiKembar },
      'POST /api/penerbit/misi/30/periksa/': {
        body: { hasil: 'benar', selesai: true, hadiah_baru: [], kata: ['terus'], pengganti: ['setelah itu'], versi_benar: 'Makan dulu. Setelah itu minum.' },
      },
    })
    tampil('/modul/3/misi/1')
    const contoh = await screen.findByRole('region', { name: 'Contoh dari Oren' })
    expect(within(contoh).getAllByText('Terus').every((el) => el.classList.contains('sorot-oren'))).toBe(true)
    expect(screen.queryByRole('button', { name: 'Terus' })).toBeNull()
    await userEvent.click(within(contoh).getByRole('button', { name: 'Lanjut' }))
    await userEvent.click(within(contoh).getByRole('button', { name: 'Giliranku!' }))

    expect(screen.getByRole('note', { name: 'Bantuan Oren' })).toHaveTextContent('Kata "terus" muncul dua kali.')
    screen.getAllByRole('button', { name: 'Terus' }).forEach((b) => expect(b).toHaveClass('bantuan-tunjuk'))
    expect(screen.getByRole('button', { name: 'makan' })).not.toHaveClass('bantuan-tunjuk')

    await userEvent.click(screen.getAllByRole('button', { name: 'Terus' })[0])
    await userEvent.click(screen.getByRole('button', { name: 'Ini kata kembarnya!' }))
    expect(await screen.findByText('Makan dulu. Setelah itu minum.')).toBeInTheDocument()
    expect(screen.queryByRole('note', { name: 'Bantuan Oren' })).toBeNull()
  })

  it('kembar tahap petunjuk: hanya hitungannya, tanpa letak', async () => {
    pasangFetch({
      'GET /api/penerbit/modul/3/': { body: MODUL_3 },
      'GET /api/penerbit/misi/31/': {
        body: { ...misiKembar, id: 31, urutan: 2, berikutnya: null, tahap: 'petunjuk', tahap_label: 'Dengan petunjuk', contoh: undefined, bantuan: { tingkat: 'hitung', jumlah: 2 } },
      },
    })
    tampil('/modul/3/misi/2')
    expect(await screen.findByRole('note', { name: 'Bantuan Oren' })).toHaveTextContent('Ada kata yang muncul 2 kali.')
    expect(document.querySelector('.bantuan-tunjuk')).toBeNull()
    expect(screen.queryByRole('region', { name: 'Contoh dari Oren' })).toBeNull()
  })

  it('misi gunting/kembar yang sudah selesai: lihat contoh Oren lagi, atau langsung kerjakan lagi', async () => {
    pasangFetch({
      'GET /api/penerbit/modul/2/': { body: MODUL_2 },
      'GET /api/penerbit/misi/20/': {
        body: { ...misiGunting, status: 'selesai', bantuan: undefined, potong: [[3, 5]], versi_benar: 'Oren lari. Dia lompat.' },
      },
    })
    const { unmount } = tampil('/modul/2/misi/1')
    expect(await screen.findByText('Oren lari. Dia lompat.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Kerjakan lagi/ }))
    expect(screen.queryByRole('region', { name: 'Contoh dari Oren' })).toBeNull()
    expect(garis()).toHaveLength(7)
    unmount()

    pasangFetch({
      'GET /api/penerbit/modul/3/': { body: MODUL_3 },
      'GET /api/penerbit/misi/30/': {
        body: { ...misiKembar, status: 'selesai', bantuan: undefined, kata: ['terus'], versi_benar: 'Makan dulu. Setelah itu minum.' },
      },
    })
    tampil('/modul/3/misi/1')
    expect(await screen.findByText('Makan dulu. Setelah itu minum.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Lihat contoh Oren lagi/ }))
    const contoh = screen.getByRole('region', { name: 'Contoh dari Oren' })
    expect(within(contoh).getByText('Kata "terus" muncul lagi.')).toBeInTheDocument()
  })
  describe('Misi Jelajah: pilih 1 dari 3 tantangan', () => {
    const PILIHAN = [
      { judul: 'Rekam suaramu', kenapa: 'Dengarkan suaramu sendiri.', langkah: ['Tekan Rekam.', 'Tekan Berhenti.', 'Tekan Tandai selesai.'], teks_rekam: [] },
      { judul: 'Kalimat belibet', kenapa: 'Lidah bisa tersandung.', langkah: ['Baca keras.', 'Buat kalimat.', 'Tulis di bawah.'],
        pertanyaan: 'Tulis kalimat belibet buatanmu.', contoh: 'Ular lari lurus.' },
      { judul: 'Hariku dalam 5 kalimat', kenapa: 'Kalimat pendek enak dibaca.', langkah: ['Cetak lembarnya.', 'Tulis.', 'Tandai.'],
        lembar: { kode: 'M2-5', judul: 'Hariku dalam 5 kalimat' } },
    ]
    const jelajah = (over: Record<string, unknown> = {}) => ({
      ...dasarMisi, id: 10, urutan: 1, berikutnya: 11, judul: 'Misi Jelajah', jenis: 'tandai', tahap: 'bonus',
      tahap_label: 'Bonus', petunjuk: 'Pilih satu dari tiga tantangan.', pilihan: PILIHAN, dipilih: null, ...over,
    })

    it('memilih tantangan satu baris: langkahnya tampil, jawaban wajib, pilihan ikut terkirim', async () => {
      const calls = pasangFetch({
        'GET /api/penerbit/modul/1/': { body: MODUL },
        'GET /api/penerbit/misi/10/': { body: jelajah() },
        'POST /api/penerbit/misi/10/pilih/': { body: { dipilih: 1 } },
        'POST /api/penerbit/misi/10/tandai/': { body: { selesai: true, hadiah_baru: [] } },
      })
      tampil('/modul/1/misi/1')
      const daftar = await screen.findByRole('group', { name: 'Pilih satu tantangan' })
      expect(within(daftar).getAllByRole('button')).toHaveLength(3)
      expect(screen.queryByRole('button', { name: 'Tandai selesai' })).toBeNull()

      await userEvent.click(within(daftar).getByRole('button', { name: /Kalimat belibet/ }))
      expect(calls.find((c) => c.url.endsWith('/pilih/'))?.body).toEqual({ pilihan: 1 })
      expect(await screen.findByRole('heading', { name: 'Kalimat belibet' })).toBeInTheDocument()
      expect(screen.getByRole('list', { name: 'Langkah' })).toHaveTextContent('Buat kalimat.')
      expect(screen.getByText(/Ular lari lurus\./)).toBeInTheDocument()
      const simpan = screen.getByRole('button', { name: 'Simpan jawaban' })
      expect(simpan).toBeDisabled()
      await userEvent.type(screen.getByLabelText('Tulis kalimat belibet buatanmu.'), 'Kuku kaki kakek.')
      await userEvent.click(simpan)
      expect(calls.find((c) => c.url.endsWith('/tandai/'))?.body).toEqual({ log: 'Kuku kaki kakek.', pilihan: 1 })
      expect(await screen.findByRole('heading', { name: 'Misi 1 selesai!' })).toBeInTheDocument()
    })

    it('pilihan tersimpan dibuka langsung; boleh ganti tantangan; tantangan lembar bisa dicetak sendiri', async () => {
      const buka = vi.fn()
      vi.stubGlobal('open', buka)
      const calls = pasangFetch({
        'GET /api/penerbit/modul/1/': { body: MODUL },
        'GET /api/penerbit/misi/10/': { body: jelajah({ dipilih: 0 }) },
        'POST /api/penerbit/misi/10/pilih/': { body: { dipilih: 2 } },
        'POST /api/penerbit/misi/10/tandai/': { body: { selesai: true, hadiah_baru: [] } },
      })
      tampil('/modul/1/misi/1')
      expect(await screen.findByRole('heading', { name: 'Rekam suaramu' })).toBeInTheDocument()
      expect(screen.getByText(/Selesaikan dulu misi Si Ceroboh/)).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'Ganti tantangan' }))
      await userEvent.click(screen.getByRole('button', { name: /Hariku dalam 5 kalimat/ }))
      expect(await screen.findByRole('heading', { name: 'Hariku dalam 5 kalimat' })).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: /Cetak lembar/ }))
      expect(buka).toHaveBeenCalledWith('/cetak/M2-5', '_blank', 'noopener')
      await userEvent.click(screen.getByRole('button', { name: 'Tandai selesai' }))
      expect(calls.find((c) => c.url.endsWith('/tandai/'))?.body).toEqual({ pilihan: 2 })
    })

    it('sudah selesai: tantangan yang dipilih disebut, dan boleh mencoba tantangan lain', async () => {
      pasangFetch({
        'GET /api/penerbit/modul/1/': { body: MODUL },
        'GET /api/penerbit/misi/10/': { body: jelajah({ dipilih: 1, status: 'selesai' }) },
      })
      tampil('/modul/1/misi/1')
      expect(await screen.findByText(/Kamu sudah mengerjakan: Kalimat belibet/)).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: /Coba tantangan lain/ }))
      expect(screen.getByRole('group', { name: 'Pilih satu tantangan' })).toBeInTheDocument()
    })
  })
})
