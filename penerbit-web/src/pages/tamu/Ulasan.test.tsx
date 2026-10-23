import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pasangFetch } from '../../test/fetch'
import { ME_TAMU, tampilHalaman } from '../ujiHalaman'
import DaftarUlasan from './DaftarUlasan'
import Ulasan from './Ulasan'

describe('Editor Tamu', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('membuka cerita yang dibagikan dan mengirim Kartu Ulasan setelah ketiga bagian diisi', async () => {
    let ulasan: unknown[] = []
    const calls = pasangFetch({
      'GET /api/penerbit/me/': { body: ME_TAMU },
      'GET /api/penerbit/ulasan/': { body: [{ id: 9, judul: 'Sandal Jepit yang Hilang', penulis: 'Fatih', versi: 3, tanggal: '2026-10-20T00:00:00Z' }] },
      'GET /api/penerbit/ulasan/9/': () => ({
        body: { id: 9, judul: 'Sandal Jepit yang Hilang', penulis: 'Fatih', versi: 3, teks: 'Fatih punya sandal.\nRak kosong.', isi: {}, ulasan_saya: ulasan },
      }),
      'POST /api/penerbit/ulasan/9/': (_u, init) => {
        ulasan = [{ ...JSON.parse(String(init.body)), tanggal: '2026-10-21T00:00:00Z' }]
        return { status: 201, body: { id: 1 } }
      },
    })
    tampilHalaman('/ulasan', { '/ulasan': <DaftarUlasan />, '/ulasan/:id': <Ulasan /> })
    const u = userEvent.setup()
    await u.click(await screen.findByRole('link', { name: /Sandal Jepit yang Hilang/ }))
    expect(await screen.findByText('Rak kosong.')).toBeInTheDocument()

    await u.type(screen.getByLabelText('Bagian favoritku'), 'Waktu Fatih menendang tiang.')
    await u.type(screen.getByLabelText('Bagian yang membuatku bingung'), 'Siapa Kakek Darto?')
    await u.click(screen.getByRole('button', { name: 'Kirim ulasan' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('ketiga bagian')
    expect(calls.some((c) => c.method === 'POST')).toBe(false)

    await u.type(screen.getByLabelText('Satu pertanyaan untuk penulis'), 'Sandalnya ketemu?')
    await u.click(screen.getByRole('button', { name: 'Kirim ulasan' }))
    expect(await screen.findByText(/ulasanmu sudah terkirim/)).toBeInTheDocument()
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
      favorit: 'Waktu Fatih menendang tiang.', membingungkan: 'Siapa Kakek Darto?', pertanyaan: 'Sandalnya ketemu?',
    })
    expect(await screen.findByText('Ulasanmu sebelumnya')).toBeInTheDocument()
  })
})
