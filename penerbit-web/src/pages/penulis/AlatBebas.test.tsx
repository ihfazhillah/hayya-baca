/** Spec 075 K4 · Alat Bebas: tempel paragraf apa saja, pakai stabilo alat yang sudah terbuka,
 *  nyalakan tanda sistem. Tidak dinilai, tidak disimpan sebagai naskah. */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pasangFetch } from '../../test/fetch'
import AlatBebas from './AlatBebas'

vi.mock('../../editor/Editor', async () => await import('../../editor/EditorPalsu'))

const slot = (perunggu: boolean) => [
  { tingkat: 'perunggu', punya: perunggu, tanggal: null, syarat_teks: '', oleh_pemeriksa: false, kemajuan: null },
  { tingkat: 'perak', punya: false, tanggal: null, syarat_teks: '', oleh_pemeriksa: false, kemajuan: null },
  { tingkat: 'emas', punya: false, tanggal: null, syarat_teks: '', oleh_pemeriksa: false, kemajuan: null },
]
const alat = (kode: string, nama: string, terbuka: boolean, perunggu: boolean) => ({
  kode, nama, emoji: '🔧', pertanyaan: '', cara_pakai: '', contoh_sebelum: '', contoh_sesudah: '',
  warna: '--color-actor-1', pola_cetak: 'tebal', modul_belajar: 1, terbuka, slot: slot(perunggu),
})
const ALAT = [
  alat('pengeras', 'Pengeras Suara', true, true),
  alat('kembar', 'Detektor Kembar', true, true),
  alat('gunting', 'Gunting', false, false),
]
const TEKS = 'Kucing lucu. Kucing makan. Kucing tidur. Kucing main.'

describe('Alat Bebas', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('tempel teks, stabilo alat yang terbuka, tanda kata kembar, teks diingat di tablet', async () => {
    const calls = pasangFetch({
      'GET /api/penerbit/alat/': { body: { alat: ALAT } },
      'POST /api/penerbit/alat-bebas/sorotan-sistem/': {
        body: [0, 13, 27, 41].map((index) => ({ alat: 'kembar', index, length: 6, sumber: 'sistem', diperbaiki: false })),
      },
    })
    const { unmount } = render(<MemoryRouter><AlatBebas /></MemoryRouter>)
    await userEvent.type(await screen.findByLabelText('Tempel atau ketik paragrafmu'), TEKS)
    await userEvent.click(screen.getByRole('button', { name: 'Pakai stabilo' }))

    const editor = await screen.findByTestId('editor')
    expect(editor).toHaveAttribute('data-mode', 'stabilo')
    expect(editor).toHaveTextContent(TEKS)
    // Hanya alat yang sudah dipelajari ada di bilah stabilo.
    expect(editor).toHaveTextContent('pengeras,kembar')
    // Gunting belum terbuka: tidak ada tanda kalimat panjang.
    expect(screen.queryByLabelText(/kalimat panjang/)).toBeNull()

    await userEvent.click(screen.getByLabelText(/Tandai kata kembar/))
    const minta = calls.find((c) => c.method === 'POST')
    expect(minta?.body).toEqual({ teks: TEKS, alat: ['kembar'] })
    expect(await screen.findByTestId('editor')).toHaveAttribute('data-sorotan', '4')
    expect(screen.getByText(/Tidak dinilai dan tidak disimpan/)).toBeInTheDocument()
    expect(calls.some((c) => c.url.includes('/naskah'))).toBe(false)

    // Kembali lagi: teks terakhir masih ada.
    unmount()
    render(<MemoryRouter><AlatBebas /></MemoryRouter>)
    expect(await screen.findByLabelText('Tempel atau ketik paragrafmu')).toHaveValue(TEKS)
  })

  it('belum ada alat yang terbuka', async () => {
    pasangFetch({ 'GET /api/penerbit/alat/': { body: { alat: [alat('pengeras', 'Pengeras Suara', false, false)] } } })
    render(<MemoryRouter><AlatBebas /></MemoryRouter>)
    expect(await screen.findByText(/terbuka setelah kamu belajar alat pertamamu/)).toBeInTheDocument()
  })
})
