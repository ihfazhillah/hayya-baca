import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pasangFetch } from '../../test/fetch'
import { P, naskah } from '../../editor/fixtur'
import DrafNol from './DrafNol'

vi.mock('../../editor/Editor', async () => await import('../../editor/EditorPalsu'))

const DRAF = { isi: { ops: [{ insert: 'Sore itu hujan.\n' }] }, teks: 'Sore itu hujan.', sorotan: [], lapis: '', waktu_klien: 10, menulis_tambahan_dari: null }

function tampil() {
  return render(
    <MemoryRouter initialEntries={['/naskah/5/draf-nol']}>
      <Routes><Route path="/naskah/:id/draf-nol" element={<DrafNol />} /></Routes>
    </MemoryRouter>,
  )
}

describe('Draf Nol', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('timer 15 menit, tulisan tambahan dicatat, lalu Versi 1 masuk Laci', async () => {
    const calls = pasangFetch({
      [`GET ${P}/naskah/5/`]: { body: naskah({ tahap: 'draf_nol', versi: [], draf: DRAF, kartu_tebakan: '' }) },
      [`POST ${P}/naskah/5/simpan/`]: { body: { tersimpan: '', waktu_klien: 1 } },
      [`PATCH ${P}/naskah/5/`]: { body: naskah({ tahap: 'draf_nol' }) },
      [`POST ${P}/naskah/5/versi/`]: { status: 201, body: { nomor: 1, lapis: '', hadiah_baru: [] } },
    })
    tampil()
    const editor = await screen.findByTestId('editor')
    expect(editor).toHaveAttribute('data-mode', 'draf_nol')
    expect(editor).toHaveAttribute('data-nonaktif', 'true')
    expect(screen.getByText('Sore itu hujan.')).toBeInTheDocument()
    expect(screen.getByText('Fatih')).toBeInTheDocument() // Peta 4 Kotak di samping

    fireEvent.click(screen.getByRole('button', { name: /Mulai/ }))
    expect(screen.getByTestId('editor')).toHaveAttribute('data-timer', 'true')
    expect(screen.getByTestId('editor')).toHaveAttribute('data-nonaktif', 'false')
    expect(screen.getByRole('timer')).toHaveTextContent('15:00')
    expect(screen.queryByRole('button', { name: /Simpan sebagai Versi 1/ })).toBeNull()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15 * 60 * 1000 + 500)
    })
    expect(screen.getByTestId('editor')).toHaveAttribute('data-timer', 'false')
    // menulis setelah timer habis
    fireEvent.click(screen.getByRole('button', { name: 'ketik palsu' }))
    expect(screen.getByText('4')).toBeInTheDocument() // jumlah kata

    fireEvent.change(screen.getByLabelText('Kartu Tebakan'), { target: { value: 'Bagian lampu mati' } })
    fireEvent.click(screen.getByRole('button', { name: 'Simpan sebagai Versi 1 dan masukkan ke Laci' }))
    expect(await screen.findByRole('heading', { name: 'Masuk Laci Rahasia' })).toBeInTheDocument()

    const simpan = calls.find((c) => c.url === `${P}/naskah/5/simpan/`)
    expect(simpan?.body).toMatchObject({ teks: 'Sore itu hujan. tambah', menulis_tambahan_dari: 'Sore itu hujan.'.length })
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ kartu_tebakan: 'Bagian lampu mati' })
    expect(calls.some((c) => c.url === `${P}/naskah/5/versi/`)).toBe(true)
  })

  it('isi yang belum terkirim di perangkat dipakai bila lebih baru', async () => {
    localStorage.setItem('penerbit.draf.5', JSON.stringify({ ...DRAF, teks: 'Dari perangkat.', isi: { ops: [{ insert: 'Dari perangkat.\n' }] }, waktu_klien: 99 }))
    pasangFetch({
      [`GET ${P}/naskah/5/`]: { body: naskah({ tahap: 'draf_nol', versi: [], draf: DRAF }) },
      [`POST ${P}/naskah/5/simpan/`]: { body: { tersimpan: '', waktu_klien: 99 } },
    })
    tampil()
    expect(await screen.findByText('Dari perangkat.')).toBeInTheDocument()
  })

  it('naskah yang sudah lewat Draf Nol tidak bisa ditulis lagi', async () => {
    pasangFetch({ [`GET ${P}/naskah/5/`]: { body: naskah({ tahap: 'laci' }) } })
    tampil()
    expect(await screen.findByRole('heading', { name: 'Draf Nol sudah selesai' })).toBeInTheDocument()
    expect(screen.queryByTestId('editor')).toBeNull()
  })
})
