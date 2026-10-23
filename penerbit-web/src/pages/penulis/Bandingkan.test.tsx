import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { pasangFetch } from '../../test/fetch'
import { ALAT, P, TEKS_V1, TEKS_V2, naskah, versi } from '../../editor/fixtur'
import Bandingkan from './Bandingkan'

function tampil() {
  return render(
    <MemoryRouter initialEntries={['/naskah/5/bandingkan']}>
      <Routes><Route path="/naskah/:id/bandingkan" element={<Bandingkan />} /></Routes>
    </MemoryRouter>,
  )
}

const iFatih = TEKS_V1.indexOf('Fatih sedih.')
const V1 = versi(1, TEKS_V1, { sorotan: [{ alat: 'kamera', index: iFatih, length: 12, sumber: 'anak', diperbaiki: false }] })
const V2 = versi(2, TEKS_V2, {
  sorotan: [{ alat: 'kamera', index: TEKS_V2.indexOf('Mata'), length: 'Mata Fatih mulai panas.'.length, sumber: 'anak', diperbaiki: true }],
})

describe('Sebelum dan Sesudah', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('Versi 1 vs terbaru: paragraf berubah ditandai, sorotan diperbaiki, paragraf favorit', async () => {
    const calls = pasangFetch({
      [`GET ${P}/naskah/5/`]: { body: naskah() },
      [`GET ${P}/alat/`]: { body: { alat: ALAT } },
      [`GET ${P}/naskah/5/versi/1/`]: { body: V1 },
      [`GET ${P}/naskah/5/versi/2/`]: { body: V2 },
      [`POST ${P}/naskah/5/favorit/`]: { body: { sebelum: 'Rak sandalnya kosong. Fatih sedih.', sesudah: 'Rak sandalnya kosong. Mata Fatih mulai panas.' } },
    })
    const u = userEvent.setup()
    tampil()
    const kiri = await screen.findByRole('region', { name: 'Versi 1' })
    const kanan = await screen.findByRole('region', { name: 'Versi 2' })
    expect(screen.getByLabelText('Kiri')).toHaveValue('1')
    expect(screen.getByLabelText('Kanan')).toHaveValue('2')
    expect(kiri.querySelector('.sorot-kamera')).toHaveTextContent('Fatih sedih.')
    expect(kanan.querySelector('.sorot-kamera.sorot-ok')).toHaveTextContent('Mata Fatih mulai panas.')
    // paragraf pertama sama, paragraf kedua berubah
    expect(kanan.querySelectorAll('.paragraf.berubah')).toHaveLength(1)
    expect(screen.getByRole('region', { name: 'Perubahanmu' })).toHaveTextContent(/1 dari 1\s*sorotan sudah diperbaiki/)

    await u.click(screen.getByRole('button', { name: /Jadikan paragraf favorit/ }))
    expect(await screen.findByText('⭐ Paragraf favoritmu')).toBeInTheDocument()
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
      sebelum: 'Rak sandalnya kosong. Fatih sedih.', sesudah: 'Rak sandalnya kosong. Mata Fatih mulai panas.',
    })
  })

  it('baru satu versi: belum bisa dibandingkan', async () => {
    pasangFetch({
      [`GET ${P}/naskah/5/`]: { body: naskah({ versi: [{ nomor: 1, lapis: '', tanggal: '', jumlah_kata: 6 }] }) },
      [`GET ${P}/alat/`]: { body: { alat: ALAT } },
      [`GET ${P}/naskah/5/versi/1/`]: { body: V1 },
    })
    tampil()
    expect(await screen.findByText(/Baru ada 1 versi/)).toBeInTheDocument()
  })
})
