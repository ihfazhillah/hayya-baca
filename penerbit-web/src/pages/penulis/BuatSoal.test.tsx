/** Spec 075 K4 · Buat soal untuk Ayah: anak menulis teks Si Ceroboh, menandai kesalahan yang dia
 *  sembunyikan, lalu melihat siapa yang sudah mencoba. */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { pasangFetch } from '../../test/fetch'
import BuatSoal from './BuatSoal'

const P = '/api/penerbit'
const tok = (teks: string[]) => teks.map((t, i) => ({ i, t, j: t === ' ' ? 'spasi' : /\w/.test(t) ? 'kata' : 'tanda' }))
// "Oren makan makan ikan."
const TOKENS = tok(['Oren', ' ', 'makan', ' ', 'makan', ' ', 'ikan', '.'])
// "Oren pergi.Lalu tidur"
const TOKENS_KACA = tok(['Oren', ' ', 'pergi', '.', 'Lalu', ' ', 'tidur'])

const ALAT = [
  { kode: 'pengeras', nama: 'Pengeras Suara', emoji: '🔊', warna: '--color-actor-1', terbuka: true, celah: false, syarat: '' },
  { kode: 'kaca', nama: 'Kaca Pembesar', emoji: '🔍', warna: '--color-actor-5', terbuka: true, celah: true, syarat: '' },
  { kode: 'kembar', nama: 'Detektor Kembar', emoji: '🔁', warna: '--color-actor-3', terbuka: false, celah: false,
    syarat: 'Terbuka setelah stiker Perak Detektor Kembar.' },
]
const SOAL_LAMA = {
  id: 7, alat: ALAT[0], teks: 'Dia senang senang.', dibuat: '2026-10-22T08:00:00Z', tokens: [], kunci: [],
  celah: false, jumlah: 2, kenapa: ['', ''],
  jawaban: [
    { oleh: 'Ayah', ditemukan: 1, total: 2, meleset: 3, selesai: true, tanggal: '2026-10-22T09:00:00Z' },
    { oleh: 'Ummah', ditemukan: 1, total: 2, meleset: 0, selesai: false, tanggal: '2026-10-22T09:00:00Z' },
  ],
}

describe('Buat soal untuk Ayah', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('tulis teks, tandai kesalahan dengan alasan, simpan; hasil Ayah dan Ummah terlihat', async () => {
    const calls = pasangFetch({
      'GET /api/penerbit/soal-buatan/': { body: { alat: ALAT, soal: [SOAL_LAMA], batas: { teks: 600, kesalahan: 8 } } },
      'POST /api/penerbit/soal-buatan/token/': { body: { teks: 'Oren makan makan ikan.', tokens: TOKENS } },
      'POST /api/penerbit/soal-buatan/': { status: 201, body: { ...SOAL_LAMA, id: 8, jawaban: [], pesan: 'Soalmu sudah disimpan.' } },
    })
    render(<MemoryRouter><BuatSoal /></MemoryRouter>)

    // Hasil soal lama: siapa mencoba dan berapa yang ditemukan.
    const lama = await screen.findByRole('article', { name: /Soal Pengeras Suara/ })
    expect(within(lama).getByText('Ayah menemukan 1 dari 2')).toBeInTheDocument()
    expect(within(lama).getByText('Ummah sedang mencari: 1 dari 2')).toBeInTheDocument()

    // Alat yang belum Perak tidak bisa dipilih.
    expect(screen.getByRole('radio', { name: /Detektor Kembar/ })).toBeDisabled()
    expect(screen.getByText('Terbuka setelah stiker Perak Detektor Kembar.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: /Pengeras Suara/ }))
    await userEvent.type(screen.getByLabelText('Teks Si Ceroboh'), 'Oren makan makan ikan.')
    await userEvent.click(screen.getByRole('button', { name: 'Tandai kesalahan' }))

    const teks = await screen.findByRole('group', { name: 'Ketuk kata yang salah' })
    // Tanpa mode celah, tanda baca tidak bisa ditandai.
    expect(within(teks).queryByRole('button', { name: '.' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Simpan soal' })).toBeDisabled()
    await userEvent.click(within(teks).getAllByRole('button', { name: 'makan' })[1])
    expect(within(teks).getAllByRole('button', { name: 'makan' })[1]).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('1 kesalahan ditandai')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Kenapa "makan" salah? (boleh kosong)'), 'Ada dua.')
    await userEvent.click(screen.getByRole('button', { name: 'Simpan soal' }))

    const kirim = calls.find((c) => c.method === 'POST' && c.url === `${P}/soal-buatan/`)
    expect(kirim?.body).toEqual({ alat: 'pengeras', teks: 'Oren makan makan ikan.', kesalahan: [{ token: 4, kenapa: 'Ada dua.' }] })
    expect(await screen.findByText('Soalmu sudah disimpan.')).toBeInTheDocument()
  })

  it('Kaca Pembesar: celah dan tanda baca bisa ditandai', async () => {
    const calls = pasangFetch({
      'GET /api/penerbit/soal-buatan/': { body: { alat: ALAT, soal: [], batas: { teks: 600, kesalahan: 8 } } },
      'POST /api/penerbit/soal-buatan/token/': { body: { teks: 'Oren pergi.Lalu tidur', tokens: TOKENS_KACA } },
      'POST /api/penerbit/soal-buatan/': { status: 201, body: { ...SOAL_LAMA, jawaban: [], pesan: 'ok' } },
    })
    render(<MemoryRouter><BuatSoal /></MemoryRouter>)
    expect(await screen.findByText(/Belum ada soal/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: /Kaca Pembesar/ }))
    await userEvent.type(screen.getByLabelText('Teks Si Ceroboh'), 'Oren pergi.Lalu tidur')
    await userEvent.click(screen.getByRole('button', { name: 'Tandai kesalahan' }))
    const teks = await screen.findByRole('group', { name: 'Ketuk kata yang salah' })
    await userEvent.click(within(teks).getByRole('button', { name: 'celah sebelum Lalu' }))
    await userEvent.click(screen.getByRole('button', { name: 'Simpan soal' }))
    const kirim = calls.find((c) => c.method === 'POST' && c.url === `${P}/soal-buatan/`)
    expect(kirim?.body).toEqual({ alat: 'kaca', teks: 'Oren pergi.Lalu tidur', kesalahan: [{ celah: 4, kenapa: '' }] })
  })
})
