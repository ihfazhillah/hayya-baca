import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RuangLatihan from './RuangLatihan'
import { pasangFetch } from '../../test/fetch'
import type { Token } from '../../types'

function tokens(teks: string): Token[] {
  return (teks.match(/\w+|\s+|./g) ?? []).map((t, i) => ({
    i, t, j: /^\s+$/.test(t) ? 'spasi' : /^\w/.test(t) ? 'kata' : 'tanda',
  }))
}

const ALAT = { kode: 'pengeras', nama: 'Pengeras Suara', emoji: '🔊', warna: '--color-actor-1', pertanyaan: 'Apakah lidahku tersandung?' }
const kartu = (id: number, teks: string, dicoba = false) => ({
  id, kode: `pengeras-${id}`, jenis: 'klik', dicoba, kata_umum: [], tokens: tokens(teks), celah: false, jumlah: 1,
})

function tampil() {
  return render(
    <MemoryRouter initialEntries={['/alat/pengeras/latihan']}>
      <Routes>
        <Route path="/alat/:kode/latihan" element={<RuangLatihan />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Ruang Latihan alat', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('menampilkan kemajuan, memainkan teks yang belum dicoba, lalu lanjut ke teks berikutnya', async () => {
    let ruang = {
      alat: ALAT, dicoba: 3, jumlah: 12,
      kartu: [kartu(1, 'Oren makan makan ikan.'), kartu(2, 'Oren tidur tidur.'), kartu(3, 'Lama.', true)],
      perak: { punya: false, syarat_teks: 'Temukan 4 dari 5 kesalahan di teks baru, 2 kali', kemajuan: { sekarang: 1, target: 2 } },
    }
    const calls = pasangFetch({
      'GET /api/penerbit/alat/pengeras/latihan/': () => ({ body: ruang }),
      'POST /api/penerbit/latihan/1/klik/': () => {
        ruang = { ...ruang, dicoba: 4, kartu: [ruang.kartu[1], ruang.kartu[2], { ...ruang.kartu[0], dicoba: true }] }
        return {
          body: {
            hasil: 'ketemu', ditemukan: 1, total: 1, meleset: 0, boleh_petunjuk: false, selesai: true,
            versi_benar: 'Oren makan ikan.', kunci: [[{ token: [4], celah: null }]], hadiah_baru: [],
          },
        }
      },
    })
    tampil()
    expect(await screen.findByRole('heading', { name: /Ruang Latihan Pengeras Suara/ })).toBeInTheDocument()
    expect(screen.getByText('3 dari 12 teks sudah kamu coba')).toBeInTheDocument()
    expect(screen.getByText('Temukan 4 dari 5 kesalahan di teks baru, 2 kali')).toBeInTheDocument()
    expect(screen.getByText('Perak: 1 dari 2')).toBeInTheDocument()
    expect(screen.getByText('Teks baru')).toBeInTheDocument()

    await userEvent.click(screen.getAllByRole('button', { name: 'makan' })[1])
    expect(calls.find((c) => c.method === 'POST')?.url).toContain('/latihan/1/klik/')
    expect(await screen.findByText('Oren makan ikan.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Teks berikutnya' }))
    expect(await screen.findByText('4 dari 12 teks sudah kamu coba')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'tidur' }).length).toBe(2)
  })

  it('alat tanpa Perunggu: pesan ramah dan jalan ke modulnya', async () => {
    pasangFetch({
      'GET /api/penerbit/alat/pengeras/latihan/': {
        status: 403, body: { detail: 'Ruang Latihan Pengeras Suara terbuka setelah kamu mendapat stiker Perunggu di Modul 1.' },
      },
    })
    tampil()
    expect(await screen.findByText(/terbuka setelah kamu mendapat stiker Perunggu/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Kembali ke Kotak Alat' })).toHaveAttribute('href', '/alat')
  })

  it('Perak sudah didapat: tetap boleh berlatih', async () => {
    pasangFetch({
      'GET /api/penerbit/alat/pengeras/latihan/': {
        body: {
          alat: ALAT, dicoba: 12, jumlah: 12, kartu: [kartu(1, 'Oren makan makan ikan.', true)],
          perak: { punya: true, syarat_teks: 'x', kemajuan: null },
        },
      },
    })
    tampil()
    expect(await screen.findByText('12 dari 12 teks sudah kamu coba')).toBeInTheDocument()
    expect(screen.getByText(/Perak sudah kamu dapat/)).toBeInTheDocument()
    expect(screen.getByText('Diulang')).toBeInTheDocument()
  })
})
