import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import KartuAlat from './KartuAlat'
import { pasangFetch } from '../../test/fetch'

const alat = (over: Record<string, unknown>) => ({
  kode: 'pengeras', nama: 'Pengeras Suara', emoji: '🔊', pertanyaan: 'Apakah lidahku tersandung?', cara_pakai: '',
  contoh_sebelum: '', contoh_sesudah: '', warna: '--color-actor-1', pola_cetak: 'gelombang', modul_belajar: 1, terbuka: true,
  slot: [
    { tingkat: 'perunggu', punya: true, tanggal: '2026-10-06T10:00:00Z', syarat_teks: 'Bisa bersama Ayah atau Ummah', oleh_pemeriksa: false, kemajuan: null },
    { tingkat: 'perak', punya: false, tanggal: null, syarat_teks: 'Temukan semua kesalahan di teks baru, 2 kali', oleh_pemeriksa: false, kemajuan: { sekarang: 1, target: 2 } },
    { tingkat: 'emas', punya: false, tanggal: null, syarat_teks: 'Baca keras drafmu sendiri', oleh_pemeriksa: true, kemajuan: null },
  ],
  ...over,
})

describe('Kartu Alat', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('menampilkan tiga slot dengan syarat dan kemajuan; alat terkunci samar', async () => {
    pasangFetch({
      'GET /api/penerbit/alat/': {
        body: { alat: [alat({}), alat({ kode: 'kamera', nama: 'Kamera', emoji: '🎥', modul_belajar: 4, terbuka: false })] },
      },
    })
    render(<MemoryRouter><KartuAlat /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'Kotak Alat Editor' })).toBeInTheDocument()
    const p = within(screen.getByRole('article', { name: 'Pengeras Suara' }))
    expect(p.getByText('“Apakah lidahku tersandung?”')).toBeInTheDocument()
    expect(p.getByText(/^Didapat /)).toBeInTheDocument()
    expect(p.getByText('Temukan semua kesalahan di teks baru, 2 kali')).toBeInTheDocument()
    expect(p.getByText('1 dari 2')).toBeInTheDocument()
    expect(p.getByText('Diberikan Ayah atau Ummah')).toBeInTheDocument()
    expect(p.getByRole('link', { name: 'Latih alat ini' })).toHaveAttribute('href', '/latihan')

    const kamera = screen.getByRole('article', { name: 'Kamera, terkunci' })
    expect(kamera).toHaveClass('samar')
    expect(within(kamera).getByText('Terbuka di Modul 4')).toBeInTheDocument()
  })
})
