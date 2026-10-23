import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Modul from './Modul'
import { pasangFetch } from '../../test/fetch'

const PEMBUKA = 'Kamu editor untuk penulis anak umur 10 tahun.'
const slot = (tingkat: string, punya = false) => ({
  tingkat, punya, tanggal: null, syarat_teks: `syarat ${tingkat}`, oleh_pemeriksa: false,
  kemajuan: punya ? null : { sekarang: 1, target: 2 },
})
const modul = (over: Record<string, unknown>) => ({
  nomor: 1, judul: 'Pengeras Suara', emoji: '🔊', level: 1, terkunci: false,
  tujuan: 'Baca keras-keras untuk menemukan kalimat yang membuat lidah tersandung.',
  kenapa: 'Penjual bakso tahu kuahnya enak dengan mencicipinya.',
  langkah: ['Baca keras.'], resep: ['Baca kalimat keras-keras, pelan saja.'], mengapa: 'Telinga menangkap kesalahan.',
  kamus: [{ istilah: 'Tersandung', arti: 'Lidah berhenti tiba-tiba.' }], lapis: '', petunjuk_lihat: 'Bacakan teks Si Ceroboh.',
  mentor: { tahap: 'tanpa', kartu_prompt: '', pembuka: PEMBUKA },
  bertanya: { a: 'Betulkan ceritaku.', b: 'Aku sedang belajar membaca keras.' },
  misi: [
    { id: 10, urutan: 1, judul: 'Angkat tangan', tahap: 'bersama', tahap_label: 'Bersama Ayah', jenis: 'tandai', jenis_label: 'bersama Ayah', status: 'selesai', tautan: null },
    { id: 11, urutan: 2, judul: 'Klik 3 kesalahan', tahap: 'petunjuk', tahap_label: 'Dengan petunjuk', jenis: 'klik', jenis_label: 'klik', status: null, tautan: null },
    { id: 12, urutan: 3, judul: 'Lembar', tahap: 'dunia_nyata', tahap_label: 'Dunia nyata', jenis: 'cetak', jenis_label: 'cetak', status: 'menunggu', tautan: null },
  ],
  ujian: [{ id: 1, soal: 'Mana yang lebih enak dibaca?', a: 'tapi tapi', b: 'tapi' }],
  lembar: [],
  alat: {
    kode: 'pengeras', nama: 'Pengeras Suara', emoji: '🔊', warna: '--color-actor-1', pertanyaan: '', cara_pakai: '',
    contoh_sebelum: '', contoh_sesudah: '', pola_cetak: 'gelombang', modul_belajar: 1, terbuka: true,
    slot: [slot('perunggu'), slot('perak'), slot('emas')],
  },
  ...over,
})

function tampil(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/modul/:nomor" element={<Modul />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Modul', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('modul terkunci meminta menyelesaikan modul sebelumnya', async () => {
    pasangFetch({
      'GET /api/penerbit/modul/3/': {
        body: { nomor: 3, judul: 'Detektor Kembar', emoji: '🔁', level: 1, terkunci: true, pesan: 'x', modul_sebelumnya: 2 },
      },
    })
    tampil('/modul/3')
    expect(await screen.findByText('Selesaikan Modul 2 dulu, ya.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ke Modul 2' })).toHaveAttribute('href', '/modul/2')
  })

  it('modul tanpa AI: Latihan Bertanya, daftar misi dengan status, tab, dan slot stiker', async () => {
    pasangFetch({ 'GET /api/penerbit/modul/1/': { body: modul({}) } })
    tampil('/modul/1')
    expect(await screen.findByRole('heading', { name: '🔊 Pengeras Suara' })).toBeInTheDocument()
    expect(screen.getByText('Kenapa?')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Latihan Bertanya' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Mentor AI' })).toBeNull()
    expect(screen.getByText('Untuk Ayah atau Ummah: tahap Lihat')).toBeInTheDocument()

    expect(screen.getByText('Selesai')).toBeInTheDocument()
    expect(screen.getByText('menunggu Ayah atau Ummah')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Buka misi 2: Klik 3 kesalahan' })).toHaveAttribute('href', '/modul/1/misi/2')

    expect(screen.getByText('Baca kalimat keras-keras, pelan saja.')).toBeVisible()
    await userEvent.click(screen.getByRole('tab', { name: 'Kamus kata' }))
    expect(screen.getByText('Lidah berhenti tiba-tiba.')).toBeVisible()

    expect(screen.getByText(/Stiker Perunggu muncul setelah misi 1 dan 2 selesai\. Tinggal 1 misi lagi\./)).toBeInTheDocument()
  })

  it('kotak prompt Isian: salin aktif setelah keempat bagian terisi, lalu refleksi', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const calls = pasangFetch({
      'GET /api/penerbit/modul/12/': {
        body: modul({
          nomor: 12, bertanya: null,
          mentor: {
            tahap: 'isian', kartu_prompt: '', pembuka: PEMBUKA,
            isian_awal: ['Aku sedang di Modul 12.', '', 'Tolong beri aku 2 pertanyaan. Jangan tulis kalimatnya untukku.', ''],
          },
        }),
      },
      'POST /api/penerbit/prompt/': { status: 201, body: { id: 7, teks: `${PEMBUKA}\n\nisi` } },
      'PATCH /api/penerbit/prompt/7/': { body: { id: 7 } },
    })
    tampil('/modul/12')
    const kotak = await screen.findByRole('region', { name: 'Mentor AI' })
    const k = within(kotak)
    expect(k.getByLabelText(/1\. Aku sedang/)).toHaveValue('Aku sedang di Modul 12.')
    expect(k.getByLabelText(/3\. Tolong/)).toHaveValue('Tolong beri aku 2 pertanyaan. Jangan tulis kalimatnya untukku.')
    const salin = k.getByRole('button', { name: 'Salin prompt' })
    expect(salin).toBeDisabled()

    await userEvent.type(k.getByLabelText(/2\. Aku bingung/), 'Aku tidak tahu cara menunjukkan kesal.')
    expect(salin).toBeDisabled()
    await userEvent.type(k.getByLabelText(/4\. Setelah itu/), 'Setelah itu aku akan menulis di kertas.')
    expect(salin).toBeEnabled()

    await userEvent.click(salin)
    const post = calls.find((c) => c.method === 'POST')
    expect(post?.body).toMatchObject({ modul: 12 })
    expect((post?.body as { bagian: string[] }).bagian).toHaveLength(4)
    expect(writeText).toHaveBeenCalledWith(`${PEMBUKA}\n\nisi`)
    expect(k.getByRole('link', { name: /Buka Gemini/ })).toHaveAttribute('href', 'https://gemini.google.com/')

    await userEvent.click(k.getByRole('button', { name: 'Sedikit' }))
    await userEvent.type(k.getByLabelText(/Apa yang akan kuubah/), 'Lebih jelas')
    await userEvent.click(k.getByRole('button', { name: 'Simpan refleksi' }))
    expect(await k.findByText('Refleksimu tersimpan. Terima kasih!')).toBeInTheDocument()
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ refleksi_bantu: 'sedikit', refleksi_ubah: 'Lebih jelas' })
  })

  it('kotak prompt Mandiri: daftar cek muncul dan harus dicentang sebelum menyalin', async () => {
    pasangFetch({
      'GET /api/penerbit/modul/14/': {
        body: modul({ nomor: 14, bertanya: null, mentor: { tahap: 'mandiri', kartu_prompt: '', pembuka: PEMBUKA } }),
      },
    })
    tampil('/modul/14')
    const k = within(await screen.findByRole('region', { name: 'Mentor AI' }))
    for (const [i, label] of [/1\. Aku sedang/, /2\. Aku bingung/, /3\. Tolong/, /4\. Setelah itu/].entries()) {
      await userEvent.type(k.getByLabelText(label), `bagian ${i + 1}`)
    }
    const salin = k.getByRole('button', { name: 'Salin prompt' })
    expect(salin).toBeDisabled()
    for (const c of k.getAllByRole('checkbox')) await userEvent.click(c)
    expect(salin).toBeEnabled()
  })
})
