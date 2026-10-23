import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { pasangFetch } from '../../test/fetch'
import { P } from '../../editor/fixtur'
import RuangPenulis from './RuangPenulis'

const NASKAH = [
  { id: 1, judul: 'Sandal Jepit yang Hilang', tahap: 'revisi', tahap_label: 'Revisi', laci: null, stempel: ['peta'], nomor_terbitan: '', created_at: '' },
  { id: 2, judul: 'Kucing Tetangga', tahap: 'laci', tahap_label: 'Di laci', stempel: [], nomor_terbitan: '', created_at: '',
    laci: { buka: '', terkunci: true, sisa_detik: 86400 + 4 * 3600 + 30, dibuka: false } },
  { id: 3, judul: 'Listrik Padam', tahap: 'draf_nol', tahap_label: 'Draf Nol', laci: null, stempel: [], nomor_terbitan: '', created_at: '' },
]
const IDE = [{ id: 9, teks: 'Sandalku tertukar', sumur: 'kenangan', bintang: [true, false, false], tanggal: '' }]

function tampil() {
  return render(<MemoryRouter><RuangPenulis /></MemoryRouter>)
}

describe('Ruang Penulis', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('kartu naskah: tahap, stempel, laci terkunci dengan hitung mundur, tombol lanjut', async () => {
    pasangFetch({ [`GET ${P}/naskah/`]: { body: NASKAH }, [`GET ${P}/ide/`]: { body: IDE } })
    tampil()
    const sandal = (await screen.findByText('Sandal Jepit yang Hilang')).closest('article')!
    expect(within(sandal).getByText('Revisi Lapis 2 · Kamera')).toBeInTheDocument()
    expect(within(sandal).getByText(/Kamera · sekarang/)).toBeInTheDocument()
    expect(within(sandal).getByRole('link', { name: /Lanjut revisi/ })).toHaveAttribute('href', '/naskah/1/revisi/kamera')

    const kucing = screen.getByText('Kucing Tetangga').closest('article')!
    expect(within(kucing).getByText(/Buka dalam 1 hari 4 jam/)).toBeInTheDocument()
    expect(within(kucing).getByRole('link', { name: /Lihat naskah/ })).toHaveAttribute('href', '/naskah/2')

    const listrik = screen.getByText('Listrik Padam').closest('article')!
    expect(within(listrik).getByRole('link')).toHaveAttribute('href', '/naskah/3/draf-nol')
    expect(screen.getByRole('link', { name: /Tulis cerita baru/ })).toHaveAttribute('href', '/naskah/baru')
  })

  it('Bank Ide: tambah ide cepat dengan sumur, dan Tes 3 Bintang', async () => {
    const calls = pasangFetch({
      [`GET ${P}/naskah/`]: { body: [] },
      [`GET ${P}/ide/`]: { body: IDE },
      [`POST ${P}/ide/`]: { status: 201, body: { id: 10, teks: 'Payung dan ayam', sumur: 'acak', bintang: [], tanggal: '' } },
      [`PATCH ${P}/ide/9/`]: { body: { ...IDE[0], bintang: [true, true, false] } },
    })
    const u = userEvent.setup()
    tampil()
    await screen.findByText('Sandalku tertukar')
    await u.type(screen.getByLabelText('Ide baru'), 'Payung dan ayam')
    await u.selectOptions(screen.getByLabelText('Sumur'), 'acak')
    await u.click(screen.getByRole('button', { name: 'Simpan ide' }))
    expect(await screen.findByText('Payung dan ayam')).toBeInTheDocument()
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ teks: 'Payung dan ayam', sumur: 'acak' })

    const baris = screen.getByText('Sandalku tertukar').closest('li')!
    await u.click(within(baris).getByRole('button', { name: 'Ada masalahnya' }))
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ bintang: [true, true, false] })
    expect(within(baris).getByRole('button', { name: 'Ada masalahnya' })).toHaveAttribute('aria-pressed', 'true')
  })
})
