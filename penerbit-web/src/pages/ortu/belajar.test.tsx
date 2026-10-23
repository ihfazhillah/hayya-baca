/** Spec 075 K2 + K3 dari Pojok Orang Tua: pertanyaan anak dan Kartu Pamer. */
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pasangFetch } from '../../test/fetch'
import { ME_ORTU, tampilHalaman } from '../ujiHalaman'
import Dasbor from './Dasbor'
import PertanyaanAnak from './PertanyaanAnak'
import KartuPamerAnak from './KartuPamerAnak'

const P = '/api/penerbit'
const DASBOR = {
  penulis: { id: 1, nama: 'Fatih' },
  perlu_tindakan: { lembar: 0, stempel: 0, penukaran: 0, pertanyaan: 2, kartu_pamer: 1 },
  minggu_ini: { sesi: 0, misi_selesai: 0, kata_draf_nol: 0, alat: null },
  persiapan: { modul: null },
  aktivitas: [],
}
const TANYA = (id: number, dijawab = false) => ({
  id, teks: id === 1 ? 'Kenapa kata yang sama tidak boleh dua kali?' : 'Apa itu tersandung?',
  dibuat: '2026-10-22T08:00:00Z', modul: { nomor: 1, judul: 'Pengeras Suara' },
  misi: { id: 11, urutan: 2, judul: 'Oren dan ikan' }, dijawab, dijawab_pada: dijawab ? '2026-10-22T09:00:00Z' : null,
  dijawab_oleh: dijawab ? 'ayah' : null, catatan: dijawab ? 'Lidah berhenti.' : '',
})

describe('Pojok Orang Tua: belajar mandiri', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('Dasbor: angka pertanyaan terbuka dan kartu pamer baru', async () => {
    pasangFetch({
      'GET /api/penerbit/me/': { body: ME_ORTU },
      'GET /api/penerbit/ortu/dasbor/': { body: DASBOR },
    })
    tampilHalaman('/ortu', { '/ortu': <Dasbor /> })
    expect(await screen.findByRole('link', { name: /2\s*pertanyaan dari anak/ })).toHaveAttribute('href', '/ortu/pertanyaan')
    expect(screen.getByRole('link', { name: /1\s*Kartu Pamer belum diberi reaksi/ })).toHaveAttribute('href', '/ortu/kartu-pamer')
  })

  it('Pertanyaan: konteks modul/misi, lalu Sudah dijawab dengan catatan opsional', async () => {
    let dijawab = false
    const calls = pasangFetch({
      'GET /api/penerbit/me/': { body: ME_ORTU },
      'GET /api/penerbit/ortu/pertanyaan/': () => ({ body: [TANYA(1, dijawab), TANYA(2, true)] }),
      'POST /api/penerbit/ortu/pertanyaan/1/dijawab/': () => { dijawab = true; return { body: TANYA(1, true) } },
    })
    tampilHalaman('/ortu/pertanyaan', { '/ortu/pertanyaan': <PertanyaanAnak /> })
    const terbuka = await screen.findByRole('region', { name: 'Belum dijawab' })
    const kartu = within(terbuka).getByRole('article')
    expect(within(kartu).getByText('Kenapa kata yang sama tidak boleh dua kali?')).toBeInTheDocument()
    expect(within(kartu).getByText(/Modul 1 · Misi 2 · Oren dan ikan/)).toBeInTheDocument()
    await userEvent.type(within(kartu).getByLabelText('Catatan untuk anak (opsional)'), 'Supaya tidak tersandung.')
    await userEvent.click(within(kartu).getByRole('button', { name: 'Sudah dijawab' }))
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ catatan: 'Supaya tidak tersandung.' })
    expect(calls.some((c) => c.url.startsWith(`${P}/ortu/pertanyaan/?penulis=1`))).toBe(true)
    expect(await screen.findByText('Semua pertanyaan sudah dijawab.')).toBeInTheDocument()
    const sudah = screen.getByRole('region', { name: 'Sudah dijawab' })
    expect(within(sudah).getByText('Apa itu tersandung?')).toBeInTheDocument()
  })

  it('Kartu Pamer: reaksi emoji + satu kalimat, dan stiker lewat jalur stiker', async () => {
    const calls = pasangFetch({
      'GET /api/penerbit/me/': { body: ME_ORTU },
      'GET /api/penerbit/ortu/kartu-pamer/': {
        body: {
          emoji: ['👏', '❤️', '🌟'],
          kartu: [{
            id: 4, pelajaran: 'Telingaku pintar.', dibuat: '2026-10-22T08:00:00Z', diubah: '2026-10-22T08:00:00Z',
            reaksi_emoji: '', reaksi: '', reaksi_oleh: null, reaksi_pada: null,
            modul: { nomor: 1, judul: 'Pengeras Suara', emoji: '🔊' },
            hasil: { misi: 3, judul: 'Oren', sebelum: 'Oren sangat sangat suka.', sesudah: 'Oren sangat suka.' },
            alat: { kode: 'pengeras', nama: 'Pengeras Suara', emoji: '🔊', stiker: ['perunggu'] },
          }],
        },
      },
      'POST /api/penerbit/ortu/kartu-pamer/4/reaksi/': {
        body: { id: 4, pelajaran: 'Telingaku pintar.', reaksi_emoji: '👏', reaksi: 'Ayah bangga!', reaksi_oleh: 'ayah' },
      },
      'POST /api/penerbit/ortu/stiker/': { status: 201, body: { hadiah_baru: [] } },
    })
    tampilHalaman('/ortu/kartu-pamer', { '/ortu/kartu-pamer': <KartuPamerAnak /> })
    const kartu = await screen.findByRole('article', { name: /Modul 1/ })
    expect(within(kartu).getByText('Telingaku pintar.')).toBeInTheDocument()
    expect(within(kartu).getAllByRole('figure')[0]).toHaveTextContent('Oren sangat sangat suka.')
    // Stiker yang sudah dimiliki tidak ditawarkan lagi.
    const pilih = within(kartu).getByLabelText('Beri stiker (opsional)')
    expect(within(pilih).queryByRole('option', { name: /Perunggu/ })).not.toBeInTheDocument()
    await userEvent.click(within(kartu).getByRole('button', { name: '👏' }))
    await userEvent.type(within(kartu).getByLabelText('Satu kalimat (opsional)'), 'Ayah bangga!')
    await userEvent.selectOptions(pilih, 'perak')
    await userEvent.click(within(kartu).getByRole('button', { name: 'Kirim reaksi' }))
    expect(await within(kartu).findByText(/Reaksi terkirim/)).toBeInTheDocument()
    const post = calls.filter((c) => c.method === 'POST')
    expect(post[0].body).toEqual({ emoji: '👏', kalimat: 'Ayah bangga!' })
    expect(post[1].url).toBe(`${P}/ortu/stiker/?penulis=1`)
    expect(post[1].body).toMatchObject({ alat: 'pengeras', tingkat: 'perak' })
  })

  it('orang tua bisa melihat pertanyaan dari simulasinya sendiri', async () => {
    const calls = pasangFetch({
      'GET /api/penerbit/me/': { body: { ...ME_ORTU, bisa_simulasi: true } },
      'GET /api/penerbit/ortu/pertanyaan/': (url) => ({ body: url.includes('simulasi=1') ? [TANYA(2)] : [] }),
    })
    tampilHalaman('/ortu/pertanyaan', { '/ortu/pertanyaan': <PertanyaanAnak /> })
    await userEvent.click(await screen.findByRole('checkbox', { name: /simulasi saya/ }))
    expect(await screen.findByText('Apa itu tersandung?')).toBeInTheDocument()
    expect(calls.some((c) => c.url.includes('simulasi=1'))).toBe(true)
  })
})
