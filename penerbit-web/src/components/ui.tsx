import { useEffect, useState, type ReactNode } from 'react'
import type { HadiahBaru } from '../types'

/** Warna alat dari data: token CSS ("--color-actor-1") atau hex. */
export function warnaCss(warna: string): string {
  return warna.startsWith('--') ? `var(${warna})` : warna
}

/** Latar stabilo transparan dari warna alat. */
export function warnaStabilo(warna: string, persen = 28): string {
  return `color-mix(in srgb, ${warnaCss(warna)} ${persen}%, transparent)`
}

export function Memuat({ teks = 'Memuat…' }: { teks?: string }) {
  return <p className="kecil" role="status">{teks}</p>
}

/** Pesan galat yang ramah (bukan merah di area Penulis). */
export function Galat({ pesan }: { pesan: string | null }) {
  if (!pesan) return null
  return (
    <div className="callout callout-warning" role="alert">
      <span className="callout-icon">🙈</span>
      <div className="callout-content"><p>{pesan}</p></div>
    </div>
  )
}

export function KepalaHalaman({ nomor, judul, sub }: { nomor?: string | number; judul: string; sub?: ReactNode }) {
  return (
    <header className="page-header">
      {nomor !== undefined && <div className="page-number">{String(nomor).padStart(2, '0')}</div>}
      <h1 className="page-title">{judul}</h1>
      {sub && <p className="page-subtitle">{sub}</p>}
    </header>
  )
}

const NAMA_TINGKAT = { perunggu: 'Perunggu', perak: 'Perak', emas: 'Emas' } as const
export const EMOJI_TINGKAT = { perunggu: '🥉', perak: '🥈', emas: '🥇' } as const

function teksHadiah(h: HadiahBaru): { besar: string; teks: string } | null {
  if (h.jenis === 'stiker' && h.tingkat)
    return { besar: EMOJI_TINGKAT[h.tingkat], teks: `Stiker ${NAMA_TINGKAT[h.tingkat]} ${h.nama ?? ''}!` }
  if (h.jenis === 'pangkat') return { besar: '🎖️', teks: `Pangkat baru: ${h.nama}!` }
  return null
}

/** Stiker atau pangkat baru membesar dari tengah. Poin cukup ditampilkan kecil. */
export function PerayaanHadiah({ hadiah, onTutup }: { hadiah: HadiahBaru[]; onTutup: () => void }) {
  const besar = hadiah.map(teksHadiah).filter((x): x is { besar: string; teks: string } => x !== null)
  const poin = hadiah.filter((h) => h.jenis === 'poin').reduce((s, h) => s + (h.jumlah ?? 0), 0)
  const [i, setI] = useState(0)
  useEffect(() => {
    if (!besar.length) {
      const t = setTimeout(onTutup, 1500)
      return () => clearTimeout(t)
    }
  }, [besar.length, onTutup])
  if (!besar.length) {
    return poin ? <div className="lencana selesai" role="status" style={{ position: 'fixed', bottom: 24, right: 24 }}>+{poin} poin</div> : null
  }
  const h = besar[Math.min(i, besar.length - 1)]
  const lanjut = () => (i + 1 < besar.length ? setI(i + 1) : onTutup())
  return (
    <div className="perayaan" role="dialog" aria-modal="true" aria-label={h.teks}>
      <div className="isi">
        <div className="besar" aria-hidden="true">{h.besar}</div>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 800 }}>{h.teks}</p>
        {poin > 0 && <p className="kecil">+{poin} poin</p>}
        <button className="btn-besar" onClick={lanjut} autoFocus>Asyik!</button>
      </div>
    </div>
  )
}
