import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Tukar from './Tukar'
import { pasangFetch } from '../../test/fetch'

describe('Tukar poin', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('mengajukan hadiah yang poinnya cukup; yang belum cukup menyebut kekurangannya', async () => {
    let penukaran: unknown[] = []
    const calls = pasangFetch({
      'GET /api/penerbit/penukaran/': () => ({
        body: {
          total: 120,
          hadiah: [{ id: 1, nama: 'Es krim', harga: 100 }, { id: 2, nama: 'Buku baru', harga: 300 }],
          penukaran,
        },
      }),
      'POST /api/penerbit/penukaran/': () => {
        penukaran = [{ id: 9, hadiah: 'Es krim', status: 'diajukan', tanggal: '2026-10-23T08:00:00Z' }]
        return { status: 201, body: { id: 9, status: 'diajukan' } }
      },
    })
    render(<MemoryRouter><Tukar /></MemoryRouter>)
    expect(await screen.findByText('Kamu punya 120 poin.')).toBeInTheDocument()
    expect(screen.getByText('Kurang 180 poin lagi. Terus berlatih!')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Tukar' }))
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ hadiah: 1 })
    expect(await screen.findByText('menunggu Ayah atau Ummah')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Es krim')
  })
})
