import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pasangFetch } from '../test/fetch'
import { ME_ORTU, tampilHalaman } from './ujiHalaman'
import RakBuku from './RakBuku'
import Buku from './Buku'

describe('Rak Buku', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('orang tua membuka buku dari rak lalu mencetaknya', async () => {
    const print = vi.fn()
    vi.stubGlobal('print', print)
    const calls = pasangFetch({
      'GET /api/penerbit/me/': { body: ME_ORTU },
      'GET /api/penerbit/rak/': {
        body: { penulis: 'Fatih', buku: [{ id: 9, judul: 'Sandal Jepit', nomor_terbitan: 'PR-001', sampul: null, tanggal_terbit: '2026-10-22T00:00:00Z' }] },
      },
      'GET /api/penerbit/rak/9/': {
        body: {
          id: 9, judul: 'Sandal Jepit', nomor_terbitan: 'PR-001', sampul: null, tanggal_terbit: '2026-10-22T00:00:00Z',
          penulis: 'Fatih', teks: 'Fatih punya sandal.\nRak sandalnya kosong.', isi: {}, tentang_penulis: 'Fatih suka kucing.',
          paragraf_favorit: { sebelum: 'Fatih sedih.', sesudah: 'Mata Fatih mulai panas.' },
        },
      },
    })
    tampilHalaman('/rak', { '/rak': <RakBuku />, '/rak/:id': <Buku /> })
    expect(await screen.findByRole('link', { name: '← Pojok Orang Tua' })).toHaveAttribute('href', '/ortu')
    expect(screen.getByText('Buku karya Fatih')).toBeInTheDocument()
    const u = userEvent.setup()
    await u.click(await screen.findByRole('link', { name: /Sandal Jepit PR-001/ }))
    expect(await screen.findByRole('heading', { name: 'Sandal Jepit' })).toBeInTheDocument()
    expect(screen.getAllByText('Rak sandalnya kosong.').length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Tentang Penulis' })).toBeInTheDocument()
    expect(screen.getAllByText('Mata Fatih mulai panas.').length).toBeGreaterThan(0)
    await u.click(screen.getByRole('button', { name: /Cetak buku/ }))
    expect(print).toHaveBeenCalled()
    expect(calls.some((c) => c.url === '/api/penerbit/rak/9/?penulis=1')).toBe(true)
  })
})
