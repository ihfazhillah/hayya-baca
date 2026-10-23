import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, type IsiSimpan } from '../api'
import { ambilLokal, kirimIsi, kirimUlang, pilihTerbaru, simpanLokal, useSimpanOtomatis } from './antrean'

const isi = (waktu: number, teks = 'Fatih sedih.'): IsiSimpan => ({
  isi: { ops: [{ insert: teks + '\n' }] }, teks, sorotan: [], waktu_klien: waktu,
})

describe('antrean offline', () => {
  beforeEach(() => localStorage.clear())

  it('gagal jaringan → disimpan di perangkat dengan kunci penerbit.draf.<id>', async () => {
    const kirim = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    expect(await kirimIsi(7, isi(100), kirim)).toBe('antre')
    expect(localStorage.getItem('penerbit.draf.7')).toContain('Fatih sedih.')
  })

  it('tersambung lagi → dikirim ulang lalu antrean dibersihkan', async () => {
    simpanLokal(7, isi(100))
    const kirim = vi.fn().mockResolvedValue({})
    expect(await kirimUlang(7, kirim)).toBe('tersimpan')
    expect(kirim).toHaveBeenCalledWith(7, expect.objectContaining({ waktu_klien: 100 }))
    expect(ambilLokal(7)).toBeNull()
  })

  it('409 = server punya yang lebih baru → antrean dibuang', async () => {
    simpanLokal(7, isi(100))
    const kirim = vi.fn().mockRejectedValue(new ApiError(409, 'Ada versi yang lebih baru di server.'))
    expect(await kirimUlang(7, kirim)).toBe('kalah')
    expect(ambilLokal(7)).toBeNull()
  })

  it('galat lain (400) tidak masuk antrean', async () => {
    const kirim = vi.fn().mockRejectedValue(new ApiError(400, 'Naskah ini sedang tidak bisa ditulis.'))
    expect(await kirimIsi(7, isi(100), kirim)).toBe('galat')
    expect(ambilLokal(7)).toBeNull()
  })

  it('pilihTerbaru memakai salinan perangkat bila lebih baru dari server', () => {
    simpanLokal(7, isi(200, 'lokal'))
    expect(pilihTerbaru({ waktu_klien: 100, teks: 'server' }, 7)?.teks).toBe('lokal')
    expect(pilihTerbaru({ waktu_klien: 300, teks: 'server' }, 7)?.teks).toBe('server')
  })
})

describe('useSimpanOtomatis', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('menyimpan otomatis setiap 10 detik dengan waktu_klien', async () => {
    const kirim = vi.fn().mockResolvedValue({})
    const { result } = renderHook(() => useSimpanOtomatis(3, { kirim }))
    act(() => result.current.catat({ isi: { ops: [] }, teks: 'Halo', sorotan: [] }))
    expect(result.current.label).toBe('Menyimpan…')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(kirim).toHaveBeenCalledTimes(1)
    expect(kirim.mock.calls[0][1]).toMatchObject({ teks: 'Halo', waktu_klien: expect.any(Number) })
    expect(result.current.label).toBe('Tersimpan')
  })

  it('offline: pesan aman di perangkat, lalu terkirim saat online', async () => {
    const kirim = vi.fn().mockRejectedValueOnce(new TypeError('offline')).mockResolvedValue({})
    const { result } = renderHook(() => useSimpanOtomatis(3, { kirim }))
    act(() => result.current.catat({ isi: { ops: [] }, teks: 'Halo', sorotan: [] }))
    await act(async () => {
      await result.current.simpanSekarang()
    })
    expect(result.current.label).toBe('Belum tersimpan ke server, tulisanmu aman di perangkat ini')
    expect(ambilLokal(3)?.teks).toBe('Halo')
    await act(async () => {
      window.dispatchEvent(new Event('online'))
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(kirim).toHaveBeenCalledTimes(2)
    expect(ambilLokal(3)).toBeNull()
    expect(result.current.label).toBe('Tersimpan')
  })

  it('server sempat mati tanpa event online: antrean dicoba lagi pada putaran berikutnya', async () => {
    const kirim = vi.fn().mockRejectedValueOnce(new ApiError(502, 'Bad gateway')).mockResolvedValue({})
    const { result } = renderHook(() => useSimpanOtomatis(3, { kirim }))
    act(() => result.current.catat({ isi: { ops: [] }, teks: 'Halo', sorotan: [] }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(result.current.status).toBe('antre')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000)
    })
    expect(kirim).toHaveBeenCalledTimes(2)
    expect(ambilLokal(3)).toBeNull()
    expect(result.current.label).toBe('Tersimpan')
  })

  it('pindah halaman: isi yang belum terkirim ikut dikirim', () => {
    const kirim = vi.fn().mockResolvedValue({})
    const { result, unmount } = renderHook(() => useSimpanOtomatis(3, { kirim }))
    act(() => result.current.catat({ isi: { ops: [] }, teks: 'Pergi', sorotan: [] }))
    unmount()
    expect(kirim).toHaveBeenCalledWith(3, expect.objectContaining({ teks: 'Pergi' }))
  })
})
