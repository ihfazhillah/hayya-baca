/** Timer Draf Nol yang selamat dari muat ulang: waktu selesai disimpan di localStorage
 *  (`penerbit.timer.<id>`), jadi memuat ulang halaman tidak mengulang dari 15:00 dan
 *  tidak membuka kunci hapus sebelum waktunya. */
import { useCallback, useEffect, useState } from 'react'

export const KUNCI_TIMER = (id: number) => `penerbit.timer.${id}`

function bacaAkhir(id: number): number | null {
  try {
    const s = localStorage.getItem(KUNCI_TIMER(id))
    const n = s ? Number(s) : NaN
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

export function hapusTimer(id: number) {
  try {
    localStorage.removeItem(KUNCI_TIMER(id))
  } catch {
    /* abaikan */
  }
}

function sisaDari(akhir: number | null, detik: number): number {
  if (akhir === null) return detik
  return Math.max(0, Math.min(detik, Math.ceil((akhir - Date.now()) / 1000)))
}

export function useTimerDraf(id: number, detik: number) {
  const [akhir, setAkhir] = useState<number | null>(() => bacaAkhir(id))
  const [sisa, setSisa] = useState(() => sisaDari(bacaAkhir(id), detik))

  useEffect(() => {
    const a = bacaAkhir(id)
    setAkhir(a)
    setSisa(sisaDari(a, detik))
  }, [id, detik])

  const berjalan = akhir !== null && sisa > 0

  useEffect(() => {
    if (!berjalan) return
    const t = setInterval(() => setSisa(sisaDari(akhir, detik)), 250)
    return () => clearInterval(t)
  }, [berjalan, akhir, detik])

  const mulai = useCallback(() => {
    const a = Date.now() + detik * 1000
    try {
      localStorage.setItem(KUNCI_TIMER(id), String(a))
    } catch {
      /* tanpa penyimpanan: timer tetap jalan di halaman ini */
    }
    setAkhir(a)
    setSisa(detik)
  }, [id, detik])

  return { sisa, total: detik, berjalan, selesai: akhir !== null && sisa === 0, dimulai: akhir !== null, mulai }
}
