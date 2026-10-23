import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Jejak from './Jejak'
import { pasangFetch } from '../../test/fetch'

const cerita = (judul: string, n: Partial<Record<string, number | string>>) => ({
  naskah: 1, judul, tanggal: '2026-10-02T08:00:00Z', jumlah_kata: 170, kalimat_terpanjang: 24, kata_kembar: 'lalu',
  kata_kembar_jumlah: 4, kalimat_perasaan: 3, kesalahan_ejaan: 7, ejaan_per_100: 4, ...n,
})

describe('Jejak', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('kalimat utama, lima grafik, tabel, dan tanda Emas', async () => {
    pasangFetch({
      'GET /api/penerbit/jejak/': {
        body: {
          kalimat_utama: 'Draf Nol-mu makin bersih: kalimat terpanjang turun dari 24 ke 19 kata.',
          cerita: [cerita('Sandal Jepit', {}), cerita('Kucing Tetangga', { jumlah_kata: 214, kalimat_terpanjang: 19, kata_kembar: 'dia' })],
          emas: [{ alat: 'gunting', tanggal: '2026-10-16T08:00:00Z' }],
        },
      },
    })
    render(<MemoryRouter><Jejak /></MemoryRouter>)
    expect(await screen.findByText(/kalimat terpanjang turun dari 24 ke 19/)).toBeInTheDocument()
    expect(screen.getAllByRole('img')).toHaveLength(5)
    expect(screen.getByText('24 → 19')).toBeInTheDocument()
    expect(screen.getByText(/🥇 Emas Gunting/)).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: /Kucing Tetangga/ })).toBeInTheDocument()
    expect(screen.getByText('dia, 4')).toBeInTheDocument()
  })

  it('belum ada cerita', async () => {
    pasangFetch({
      'GET /api/penerbit/jejak/': {
        body: { kalimat_utama: 'Jejakmu mulai tercatat setelah Draf Nol pertama.', cerita: [], emas: [] },
      },
    })
    render(<MemoryRouter><Jejak /></MemoryRouter>)
    expect(await screen.findByText('Jejakmu mulai tercatat setelah Draf Nol pertama.')).toBeInTheDocument()
    expect(screen.queryByRole('img')).toBeNull()
  })
})
