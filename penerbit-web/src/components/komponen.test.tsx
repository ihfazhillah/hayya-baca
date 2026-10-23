import { act, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import TeksKlik from './TeksKlik'
import Gunting from './Gunting'
import DetektorKembar from './DetektorKembar'
import TombolSalin from './TombolSalin'
import { useTimer } from './Timer'
import type { HasilKlik, Token } from '../types'

function tokens(teks: string): Token[] {
  // Tokenizer sederhana untuk test (di aplikasi token selalu dari server).
  return (teks.match(/\w+(?:-\w+)*|\s+|./g) ?? []).map((t, i) => ({
    i, t, j: /^\s+$/.test(t) ? 'spasi' : /^\w/.test(t) ? 'kata' : 'tanda',
  }))
}

const hasil = (h: Partial<HasilKlik>): HasilKlik => ({
  hasil: 'meleset', ditemukan: 0, total: 2, meleset: 0, boleh_petunjuk: false, selesai: false, ...h,
})

describe('TeksKlik', () => {
  const T = tokens('Oren di di dapur. Dia makan.')

  it('mengirim indeks token dan menandai kata yang ketemu', async () => {
    const onKlik = vi.fn().mockResolvedValue(hasil({ hasil: 'ketemu', ditemukan: 1 }))
    render(<TeksKlik tokens={T} onKlik={onKlik} />)
    await userEvent.click(screen.getAllByRole('button', { name: 'di' })[0])
    expect(onKlik).toHaveBeenCalledWith({ token: 2 })
    expect(screen.getAllByRole('button', { name: 'di' })[0]).toHaveClass('ditemukan')
    expect(screen.getByRole('status')).toHaveTextContent('Ketemu! 1 dari 2.')
  })

  it('meleset memberi pesan ramah dan petunjuk muncul setelah 3 kali', async () => {
    let n = 0
    const onKlik = vi.fn().mockImplementation(async () => hasil({ meleset: ++n }))
    const onPetunjuk = vi.fn().mockResolvedValue({ kalimat: [[0, 8]] })
    render(<TeksKlik tokens={T} onKlik={onKlik} onPetunjuk={onPetunjuk} />)
    const oren = screen.getByRole('button', { name: 'Oren' })
    await userEvent.click(oren)
    expect(screen.getByRole('status')).toHaveTextContent('Bukan yang ini')
    expect(screen.queryByRole('button', { name: 'Minta petunjuk' })).toBeNull()
    await userEvent.click(oren)
    await userEvent.click(oren)
    await userEvent.click(screen.getByRole('button', { name: 'Minta petunjuk' }))
    expect(screen.getByRole('button', { name: 'Oren' })).toHaveClass('kalimat-petunjuk')
  })

  it('selesai menampilkan versi benar', async () => {
    const onSelesai = vi.fn()
    const onKlik = vi.fn().mockResolvedValue(hasil({
      hasil: 'ketemu', ditemukan: 2, selesai: true, versi_benar: 'Oren di dapur.',
      kunci: [[{ token: [2, 3, 4], celah: null }]],
    }))
    render(<TeksKlik tokens={T} onKlik={onKlik} onSelesai={onSelesai} />)
    await userEvent.click(screen.getAllByRole('button', { name: 'di' })[0])
    expect(screen.getByText('Oren di dapur.')).toBeInTheDocument()
    expect(onSelesai).toHaveBeenCalled()
  })

  it('mode celah: celah antar token bisa diklik', async () => {
    const onKlik = vi.fn().mockResolvedValue(hasil({ hasil: 'ketemu', ditemukan: 1 }))
    const t = tokens('keluar.cacing')
    render(<TeksKlik tokens={t} celah onKlik={onKlik} />)
    await userEvent.click(screen.getByRole('button', { name: 'celah sebelum cacing' }))
    expect(onKlik).toHaveBeenCalledWith({ celah: 2 })
  })
})

describe('Gunting', () => {
  it('memasang potongan di spasi lalu periksa', async () => {
    const T = tokens('Oren makan dan dia tidur.')
    const onPeriksa = vi.fn().mockResolvedValue({
      tepat: [5], tidak_perlu: [], kurang: 0, benar: 1, total: 1, selesai: true, hadiah_baru: [],
      versi_benar: 'Oren makan. Dia tidur.',
    })
    render(<Gunting tokens={T} onPeriksa={onPeriksa} />)
    const celah = screen.getAllByRole('button', { name: 'pasang garis potong di sini' })
    await userEvent.click(celah[2])
    await userEvent.click(celah[0])
    await userEvent.click(celah[0]) // dilepas lagi
    await userEvent.click(screen.getByRole('button', { name: 'Periksa' }))
    expect(onPeriksa).toHaveBeenCalledWith([5])
    expect(screen.getByText('Oren makan. Dia tidur.')).toBeInTheDocument()
  })
})

describe('DetektorKembar', () => {
  const T = tokens('Lalu Oren lari. Lalu dia makan. Lalu tidur.')

  it('menyalakan semua kata yang sama dan menghitungnya', async () => {
    const onPeriksa = vi.fn().mockResolvedValue({ hasil: 'benar', selesai: true, pengganti: ['tiba-tiba'] })
    render(<DetektorKembar tokens={T} kataUmum={['dia']} onPeriksa={onPeriksa} />)
    await userEvent.click(screen.getAllByRole('button', { name: 'Lalu' })[1])
    screen.getAllByRole('button', { name: 'Lalu' }).forEach((b) => expect(b).toHaveClass('nyala'))
    expect(screen.getByRole('status')).toHaveTextContent('"lalu" muncul 3 kali.')
    await userEvent.click(screen.getByRole('button', { name: 'Ini kata kembarnya!' }))
    expect(onPeriksa).toHaveBeenCalledWith('lalu')
    expect(screen.getByText(/tiba-tiba/)).toBeInTheDocument()
  })

  it('kata umum tidak dihitung', async () => {
    render(<DetektorKembar tokens={T} kataUmum={['dia']} onPeriksa={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'dia' }))
    expect(screen.getByRole('status')).toHaveTextContent('kata umum')
    expect(screen.getByRole('button', { name: 'Ini kata kembarnya!' })).toBeDisabled()
  })
})

describe('TombolSalin', () => {
  it('menyalin lalu menampilkan Tersalin', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<TombolSalin ambilTeks={() => 'halo'} />)
    await userEvent.click(screen.getByRole('button', { name: 'Salin prompt' }))
    expect(writeText).toHaveBeenCalledWith('halo')
    expect(screen.getByRole('button', { name: 'Tersalin ✓' })).toBeInTheDocument()
  })
})

describe('useTimer', () => {
  it('menghitung mundur sampai selesai', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useTimer(2))
    act(() => result.current.mulai())
    act(() => { vi.advanceTimersByTime(2500) })
    expect(result.current.sisa).toBe(0)
    expect(result.current.selesai).toBe(true)
    vi.useRealTimers()
  })
})
