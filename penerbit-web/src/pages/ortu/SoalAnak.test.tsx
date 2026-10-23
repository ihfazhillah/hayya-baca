/** Spec 075 K4 · Soal dari anak di Pojok Orang Tua: Ayah mengerjakan soal buatan anak dengan
 *  klik yang sama seperti misi; dinilai server per klik, kunci dibuka setelah selesai. */
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pasangFetch } from '../../test/fetch'
import { ME_ORTU, tampilHalaman } from '../ujiHalaman'
import SoalAnak, { KerjakanSoal } from './SoalAnak'
import Dasbor from './Dasbor'

const P = '/api/penerbit'
const ALAT = { kode: 'pengeras', nama: 'Pengeras Suara', emoji: '🔊', warna: '--color-actor-1' }
const TOKENS = ['Oren', ' ', 'makan', ' ', 'makan', ' ', 'ikan', '.'].map((t, i) => ({
  i, t, j: t === ' ' ? 'spasi' : t === '.' ? 'tanda' : 'kata',
}))

describe('Pojok Orang Tua: Soal dari anak', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('daftar soal dengan status milikku dan angka di dasbor', async () => {
    pasangFetch({
      'GET /api/penerbit/me/': { body: ME_ORTU },
      'GET /api/penerbit/ortu/soal-buatan/': {
        body: { penulis: 'Fatih', soal: [
          { id: 3, alat: ALAT, dibuat: '2026-10-22T08:00:00Z', jumlah: 2, punyaku: null },
          { id: 4, alat: ALAT, dibuat: '2026-10-22T08:00:00Z', jumlah: 3,
            punyaku: { diklik: [], celah: [], ditemukan: 3, total: 3, meleset: 0, selesai: true } },
        ] },
      },
    })
    tampilHalaman('/ortu/soal', { '/ortu/soal': <SoalAnak /> })
    expect(await screen.findByRole('heading', { name: 'Soal dari Fatih' })).toBeInTheDocument()
    const kartu = screen.getAllByRole('article')
    expect(within(kartu[0]).getByText(/2 kesalahan disembunyikan/)).toBeInTheDocument()
    expect(within(kartu[0]).getByRole('link', { name: 'Kerjakan' })).toHaveAttribute('href', '/ortu/soal/3')
    expect(within(kartu[1]).getByText('Kamu menemukan 3 dari 3')).toBeInTheDocument()
  })

  it('Dasbor menunjuk ke soal yang belum dikerjakan', async () => {
    pasangFetch({
      'GET /api/penerbit/me/': { body: ME_ORTU },
      'GET /api/penerbit/ortu/dasbor/': { body: {
        penulis: { id: 1, nama: 'Fatih' },
        perlu_tindakan: { lembar: 0, stempel: 0, penukaran: 0, pertanyaan: 0, kartu_pamer: 0, soal_buatan: 2 },
        minggu_ini: { sesi: 0, misi_selesai: 0, kata_draf_nol: 0, alat: null }, persiapan: { modul: null }, aktivitas: [],
      } },
    })
    tampilHalaman('/ortu', { '/ortu': <Dasbor /> })
    expect(await screen.findByRole('link', { name: /2\s*soal dari anak belum kamu kerjakan/ })).toHaveAttribute('href', '/ortu/soal')
  })

  it('mengerjakan: klik dinilai server, lalu kunci dan alasan anak terbuka', async () => {
    const calls = pasangFetch({
      'GET /api/penerbit/me/': { body: ME_ORTU },
      'GET /api/penerbit/ortu/soal-buatan/3/': { body: {
        id: 3, alat: ALAT, penulis: 'Fatih', dibuat: '2026-10-22T08:00:00Z', tokens: TOKENS, celah: false,
        jumlah: 1, punyaku: null,
      } },
      'POST /api/penerbit/ortu/soal-buatan/3/klik/': (_u, init) => {
        const b = JSON.parse(String(init.body))
        return b.token === 4
          ? { body: { hasil: 'ketemu', ditemukan: 1, total: 1, meleset: 0, selesai: true,
              kunci: [[{ token: [4], celah: null }]], kenapa: ['Kata makan ada dua.'], teks: 'Oren makan makan ikan.' } }
          : { body: { hasil: 'meleset', ditemukan: 0, total: 1, meleset: 1, selesai: false } }
      },
    })
    tampilHalaman('/ortu/soal/3', { '/ortu/soal/:id': <KerjakanSoal /> })
    expect(await screen.findByRole('heading', { name: /Soal Pengeras Suara dari Fatih/ })).toBeInTheDocument()
    expect(screen.getByText(/menyembunyikan 1 kesalahan/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Oren' }))
    expect(await screen.findByText(/Bukan yang ini/)).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: 'makan' })[1])
    expect(calls.filter((c) => c.url === `${P}/ortu/soal-buatan/3/klik/`).map((c) => c.body)).toEqual([{ token: 0 }, { token: 4 }])
    expect(await screen.findByText('Kata makan ada dua.')).toBeInTheDocument()
    expect(screen.getByText(/Fatih akan melihat hasilmu/)).toBeInTheDocument()
  })
})
