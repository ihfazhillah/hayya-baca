import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { pasangFetch } from '../../test/fetch'
import { ALAT, P, TEKS_V1, naskah, versi } from '../../editor/fixtur'
import HalamanNaskah from './HalamanNaskah'

vi.mock('../../editor/Editor', async () => await import('../../editor/EditorPalsu'))

function tampil() {
  return render(
    <MemoryRouter initialEntries={['/naskah/5']}>
      <Routes><Route path="/naskah/:id" element={<HalamanNaskah />} /></Routes>
    </MemoryRouter>,
  )
}

describe('Halaman naskah', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('revisi: jalur stempel, daftar versi hanya-baca, tombol lanjut dan bandingkan, catatan', async () => {
    pasangFetch({
      [`GET ${P}/naskah/5/`]: {
        body: naskah({
          catatan: [{ teks: 'Urutannya sudah jelas.', oleh: 'Babah', tanggal: '2026-10-06T10:00:00Z' }],
          ulasan: [{ favorit: 'Waktu Kakek melihat kakinya', membingungkan: 'Sandal siapa?', pertanyaan: 'Jadi menonton?', versi: 2, oleh: 'Kakak', tanggal: '2026-10-07T10:00:00Z' }],
        }),
      },
      [`GET ${P}/alat/`]: { body: { alat: ALAT } },
      [`GET ${P}/naskah/5/versi/1/`]: { body: versi(1, TEKS_V1) },
    })
    const u = userEvent.setup()
    tampil()
    expect(await screen.findByRole('heading', { name: 'Sandal Jepit yang Hilang' })).toBeInTheDocument()
    expect(screen.getByText(/Versi 1: 6 kata/)).toBeInTheDocument()
    expect(screen.getByLabelText('Peta, sudah')).toHaveClass('punya')
    expect(screen.getByLabelText('Kamera, sekarang')).toHaveClass('sekarang')
    expect(screen.getByRole('link', { name: 'Lanjut ke Revisi Lapis 2' })).toHaveAttribute('href', '/naskah/5/revisi/kamera')
    expect(screen.getByRole('link', { name: 'Lihat Sebelum dan Sesudah' })).toHaveAttribute('href', '/naskah/5/bandingkan')
    expect(screen.getByText('Urutannya sudah jelas.')).toBeInTheDocument()
    expect(screen.getByText('Waktu Kakek melihat kakinya')).toBeInTheDocument()

    await u.click(screen.getByRole('button', { name: 'Baca Versi 1' }))
    const ed = await screen.findByTestId('editor')
    expect(ed).toHaveAttribute('data-mode', 'baca')
    expect(ed).toHaveTextContent('Fatih punya sandal.')
  })

  it('laci terkunci: hitung mundur dan saran kegiatan', async () => {
    pasangFetch({
      [`GET ${P}/naskah/5/`]: {
        body: naskah({ tahap: 'laci', lapis_berikutnya: 'peta', stempel: [], versi: [{ nomor: 1, lapis: '', tanggal: '', jumlah_kata: 6 }],
          laci: { buka: '', terkunci: true, sisa_detik: 3 * 3600 + 600, dibuka: false } }),
      },
      [`GET ${P}/alat/`]: { body: { alat: ALAT } },
    })
    tampil()
    expect(await screen.findByText('3 jam 10 menit')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Latihan Harian' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Buka laci' })).toBeNull()
    expect(screen.queryByRole('link', { name: /Lanjut ke Revisi/ })).toBeNull()
  })

  it('buka laci menampilkan Kartu Tebakan: "Masih setuju?"', async () => {
    let tahap = 'laci'
    const calls = pasangFetch({
      [`GET ${P}/naskah/5/`]: () => ({
        body: naskah({ tahap: tahap as 'laci', lapis_berikutnya: 'peta', stempel: [], versi: [{ nomor: 1, lapis: '', tanggal: '', jumlah_kata: 6 }],
          laci: { buka: '', terkunci: false, sisa_detik: 0, dibuka: tahap !== 'laci' } }),
      }),
      [`GET ${P}/alat/`]: { body: { alat: ALAT } },
      [`POST ${P}/naskah/5/buka-laci/`]: () => {
        tahap = 'revisi'
        return { body: { kartu_tebakan: 'Bagian rak sandal', tahap: 'revisi' } }
      },
    })
    const u = userEvent.setup()
    tampil()
    await u.click(await screen.findByRole('button', { name: 'Buka laci' }))
    expect(await screen.findByText(/Masih setuju\?/)).toBeInTheDocument()
    expect(screen.getByText('“Bagian rak sandal”')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Lanjut ke Revisi Lapis 1' })).toHaveAttribute('href', '/naskah/5/revisi/peta')
    expect(calls.some((c) => c.method === 'POST')).toBe(true)
  })
})
