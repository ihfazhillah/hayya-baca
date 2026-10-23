import { useCallback, useEffect, useRef, useState } from 'react'

/** Hitung mundur dalam detik. `mulai()` sekali; `selesai` true saat habis. */
export function useTimer(detik: number) {
  const [sisa, setSisa] = useState(detik)
  const [berjalan, setBerjalan] = useState(false)
  const akhir = useRef<number | null>(null)

  useEffect(() => {
    if (!berjalan) return
    const id = setInterval(() => {
      const s = Math.max(0, Math.round(((akhir.current ?? 0) - Date.now()) / 1000))
      setSisa(s)
      if (s === 0) setBerjalan(false)
    }, 250)
    return () => clearInterval(id)
  }, [berjalan])

  const mulai = useCallback(() => {
    akhir.current = Date.now() + detik * 1000
    setSisa(detik)
    setBerjalan(true)
  }, [detik])

  return { sisa, berjalan, selesai: !berjalan && akhir.current !== null && sisa === 0, mulai }
}

export function formatMenit(detik: number) {
  const m = Math.floor(detik / 60)
  const s = detik % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function Timer({ sisa }: { sisa: number }) {
  return <div className="timer" role="timer" aria-live="off">{formatMenit(sisa)}</div>
}
