import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LatihanHarian from './LatihanHarian'
import { pasangFetch } from '../../test/fetch'
import type { Token } from '../../types'

function tokens(teks: string): Token[] {
  return (teks.match(/\w+|\s+|./g) ?? []).map((t, i) => ({
    i, t, j: /^\s+$/.test(t) ? 'spasi' : /^\w/.test(t) ? 'kata' : 'tanda',
  }))
}

const PENGERAS = { kode: 'pengeras', nama: 'Pengeras Suara', emoji: '🔊', warna: '--color-actor-1', pertanyaan: 'Apakah lidahku tersandung?' }
const GUNTING = { kode: 'gunting', nama: 'Gunting', emoji: '✂️', warna: '--color-actor-2', pertanyaan: 'Butuh lebih dari satu napas?' }

describe('Latihan Harian', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('kartu campuran menanyakan alat dulu, lalu hasil "2 dari 2!"', async () => {
    const calls = pasangFetch({
      'GET /api/penerbit/latihan/': {
        body: {
          kartu: [
            { id: 1, jenis: 'klik', alat: PENGERAS, pilihan_alat: [], selesai: false, kata_umum: [], tokens: tokens('Oren di di dapur.'), jumlah: 1 },
            { id: 2, jenis: 'gunting', alat: null, pilihan_alat: [PENGERAS, GUNTING], selesai: false, kata_umum: [], tokens: tokens('Oren makan dan dia tidur.') },
          ],
        },
      },
      'POST /api/penerbit/latihan/1/klik/': {
        body: { hasil: 'ketemu', ditemukan: 1, total: 1, meleset: 0, boleh_petunjuk: false, selesai: true, versi_benar: 'Oren di dapur.', hadiah_baru: [] },
      },
      'POST /api/penerbit/latihan/2/alat/': (_u, init) =>
        JSON.parse(String(init.body)).alat === 'gunting'
          ? { body: { benar: true, alat: GUNTING } }
          : { body: { benar: false, pesan: 'Hmm, coba baca sekali lagi. Masalahnya apa?' } },
      'POST /api/penerbit/latihan/2/periksa/': {
        body: { tepat: [5], tidak_perlu: [], kurang: 0, benar: 1, total: 1, selesai: true, hadiah_baru: [], versi_benar: 'Oren makan. Dia tidur.' },
      },
    })
    render(<MemoryRouter><LatihanHarian /></MemoryRouter>)
    expect(await screen.findByText(/Kartu 1 dari 2 · 🔊 Pengeras Suara/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Pakai timer/ })).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: 'di' })[1])
    await userEvent.click(await screen.findByRole('button', { name: 'Kartu berikutnya' }))

    expect(screen.getByText(/Kartu 2 dari 2 · Latihan campuran/)).toBeInTheDocument()
    expect(screen.getByText('Alat apa yang kamu perlukan?')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Periksa' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: '🔊 Pengeras Suara' }))
    expect(await screen.findByText('Hmm, coba baca sekali lagi. Masalahnya apa?')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: '✂️ Gunting' }))
    expect(await screen.findByText('Betul, Gunting!')).toBeInTheDocument()

    await userEvent.click(screen.getAllByRole('button', { name: 'pasang garis potong di sini' })[2])
    await userEvent.click(screen.getByRole('button', { name: 'Periksa' }))
    expect(calls.find((c) => c.url === '/api/penerbit/latihan/2/periksa/')?.body).toEqual({ potong: [5] })
    await userEvent.click(await screen.findByRole('button', { name: 'Lihat hasil' }))
    expect(screen.getByRole('heading', { name: '2 dari 2!' })).toBeInTheDocument()
  })

  it('tanpa alat jatuh tempo menampilkan pesan dari server', async () => {
    pasangFetch({ 'GET /api/penerbit/latihan/': { body: { kartu: [], pesan: 'Hari ini tidak ada pemanasan. Langsung lanjut, yuk!' } } })
    render(<MemoryRouter><LatihanHarian /></MemoryRouter>)
    expect(await screen.findByText('Hari ini tidak ada pemanasan. Langsung lanjut, yuk!')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Kembali ke Beranda' })).toHaveAttribute('href', '/')
  })
})
