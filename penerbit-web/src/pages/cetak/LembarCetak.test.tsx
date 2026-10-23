import { screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { pasangFetch } from '../../test/fetch'
import { tampilHalaman } from '../ujiHalaman'
import LembarCetak from './LembarCetak'

const ME_PENULIS = { peran: ['penulis'], penulis: { id: 1, nama: 'Fatih' }, pemeriksa: [], bisa_diaktifkan: [], tamu: false }

describe('Lembar cetak', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.unstubAllGlobals())

  it('menampilkan lembar A4 lengkap dengan kotak orang tua lalu membuka dialog cetak', async () => {
    const print = vi.fn()
    vi.stubGlobal('print', print)
    pasangFetch({
      'GET /api/penerbit/me/': { body: ME_PENULIS },
      'GET /api/penerbit/cetak/M4-3/': {
        body: {
          kode: 'M4-3', judul: 'Kalimat Kamera', petunjuk: 'Ubah kalimat menjadi kalimat Kamera.', soal: 'Ibu marah.\nOren senang.',
          baris_tulis: 4, pertanyaan_bantu: 'Apa yang dilakukan tangannya?', cek_sendiri: ['Tidak memakai kata marah.', 'Gerakannya terbayang.'],
          kriteria: 'Perasaan lewat tindakan.', contoh_jawaban: 'Ibu meletakkan sapu dengan keras.', saran_stiker: '',
          modul: { nomor: 4, judul: 'Kamera' },
        },
      },
    })
    tampilHalaman('/cetak/M4-3', { '/cetak/:kode': <LembarCetak /> })
    const lembar = await screen.findByLabelText('Lembar M4-3')
    expect(within(lembar).getByText('M4-3')).toBeInTheDocument()
    expect(within(lembar).getByText('Ibu marah.')).toBeInTheDocument()
    expect(lembar.querySelectorAll('.garis')).toHaveLength(4)
    expect(within(lembar).getByText(/Tidak memakai kata marah/)).toHaveTextContent('☐')
    const ortu = within(lembar).getByLabelText('Untuk Ayah atau Ummah')
    expect(ortu).toHaveTextContent('Ibu meletakkan sapu dengan keras.')
    expect(ortu).toHaveTextContent('Perunggu')
    expect(ortu).toHaveTextContent('Paraf')
    await waitFor(() => expect(print).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('link', { name: '← Beranda' })).toHaveAttribute('href', '/')
  })
})
