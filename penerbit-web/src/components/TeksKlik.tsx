import { Fragment, useMemo, useState } from 'react'
import type { HasilKlik, Jawaban, Target, Token } from '../types'

/** Klik Kesalahan (Pengeras Suara, Kaca Pembesar, Kamera di latihan).
 *  Penilaian di server: komponen hanya mengirim indeks token/celah yang diklik. */
export interface TeksKlikProps {
  tokens: Token[]
  celah?: boolean
  /** "Ada 3 kesalahan" (hanya tahap petunjuk). */
  jumlah?: number
  awal?: { diklik: number[]; meleset: number }
  onKlik: (target: { token?: number; celah?: number }) => Promise<HasilKlik>
  onPetunjuk?: () => Promise<{ kalimat: [number, number][] }>
  onBerhenti?: () => Promise<Jawaban & { selesai: true }>
  onSelesai?: (hasil: Jawaban & { hadiah_baru?: HasilKlik['hadiah_baru'] }) => void
}

const PESAN_MELESET = 'Bukan yang ini. Coba baca keras-keras sekali lagi.'

export default function TeksKlik({ tokens, celah = false, jumlah, awal, onKlik, onPetunjuk, onBerhenti, onSelesai }: TeksKlikProps) {
  const [diklik, setDiklik] = useState<Set<number>>(() => new Set(awal?.diklik ?? []))
  const [celahKetemu, setCelahKetemu] = useState<Set<number>>(() => new Set())
  const [ditemukan, setDitemukan] = useState(awal?.diklik.length ?? 0)
  const [total, setTotal] = useState<number | undefined>(jumlah)
  const [meleset, setMeleset] = useState(awal?.meleset ?? 0)
  const [goyang, setGoyang] = useState<number | null>(null)
  const [pesan, setPesan] = useState<string | null>(null)
  const [petunjuk, setPetunjuk] = useState<[number, number][]>([])
  const [selesai, setSelesai] = useState<(Jawaban & { selesai: true }) | null>(null)
  const [sibuk, setSibuk] = useState(false)

  const kunciTerbuka = useMemo(() => {
    const s = new Set<number>()
    const c = new Set<number>()
    selesai?.kunci?.forEach((grup: Target[]) => grup.forEach((t) => {
      t.token.forEach((i) => s.add(i))
      if (t.celah !== null) c.add(t.celah)
    }))
    return { token: s, celah: c }
  }, [selesai])

  async function klik(target: { token?: number; celah?: number }) {
    if (selesai || sibuk) return
    setSibuk(true)
    try {
      const r = await onKlik(target)
      setTotal(r.total)
      setMeleset(r.meleset)
      if (r.hasil === 'ketemu') {
        if (target.token !== undefined) setDiklik((s) => new Set(s).add(target.token!))
        if (target.celah !== undefined) setCelahKetemu((s) => new Set(s).add(target.celah!))
        setDitemukan(r.ditemukan)
        setPesan(r.ditemukan < r.total ? `Ketemu! ${r.ditemukan} dari ${r.total}.` : 'Semua ketemu!')
      } else if (r.hasil === 'meleset') {
        setGoyang(target.token ?? -1 - (target.celah ?? 0))
        setTimeout(() => setGoyang(null), 320)
        setPesan(PESAN_MELESET)
      } else {
        setPesan('Yang ini sudah kamu temukan.')
      }
      if (r.selesai) {
        setSelesai({ ...r, selesai: true })
        onSelesai?.(r)
      }
    } finally {
      setSibuk(false)
    }
  }

  async function mintaPetunjuk() {
    if (!onPetunjuk) return
    const r = await onPetunjuk()
    setPetunjuk(r.kalimat)
    setPesan('Ada kesalahan di kalimat yang kuning.')
  }

  async function berhenti() {
    if (!onBerhenti) return
    const r = await onBerhenti()
    setSelesai(r)
    onSelesai?.(r)
  }

  const diPetunjuk = (i: number) => petunjuk.some(([a, b]) => i >= a && i <= b)

  return (
    <div className="tumpuk">
      {jumlah !== undefined && !selesai && <p className="kecil">Ada {jumlah} kesalahan.</p>}
      <div className="teks-latihan" aria-label="Teks latihan">
        {tokens.map((t) => {
          const tombolCelah = celah && t.i > 0 && t.j !== 'spasi' && tokens[t.i - 1].j !== 'spasi'
          return (
            <Fragment key={t.i}>
              {tombolCelah && (
                <button
                  type="button"
                  className={`celah${celahKetemu.has(t.i) || kunciTerbuka.celah.has(t.i) ? ' ditemukan' : ''}`}
                  aria-label={`celah sebelum ${t.t}`}
                  onClick={() => klik({ celah: t.i })}
                />
              )}
              {t.j === 'spasi' ? (
                celah ? (
                  <button type="button" className={`kata tanda${diklik.has(t.i) ? ' ditemukan' : ''}${diPetunjuk(t.i) ? ' kalimat-petunjuk' : ''}`}
                    aria-label="spasi" onClick={() => klik({ token: t.i })}>{' '}</button>
                ) : (
                  <span className={diPetunjuk(t.i) ? 'kalimat-petunjuk' : undefined}>{t.t}</span>
                )
              ) : (
                <button
                  type="button"
                  className={[
                    'kata',
                    t.j === 'tanda' ? 'tanda' : '',
                    diklik.has(t.i) || kunciTerbuka.token.has(t.i) ? 'ditemukan' : '',
                    goyang === t.i ? 'meleset' : '',
                    diPetunjuk(t.i) ? 'kalimat-petunjuk' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => (t.j === 'kata' || celah ? klik({ token: t.i }) : undefined)}
                  disabled={!!selesai}
                >
                  {t.t}
                </button>
              )}
            </Fragment>
          )
        })}
        {celah && (
          <button type="button" className={`celah${celahKetemu.has(tokens.length) || kunciTerbuka.celah.has(tokens.length) ? ' ditemukan' : ''}`}
            aria-label="celah di akhir" onClick={() => klik({ celah: tokens.length })} />
        )}
      </div>
      {total !== undefined && (
        <div className="penghitung" aria-live="polite">
          {ditemukan} dari {total} kesalahan ditemukan
          <div className="batang"><span style={{ width: `${total ? (ditemukan / total) * 100 : 0}%` }} /></div>
        </div>
      )}
      {pesan && !selesai && <p role="status">{pesan}</p>}
      {selesai?.versi_benar && (
        <div className="callout callout-accent">
          <div className="callout-content">
            <span className="callout-title">Versi yang sudah dibetulkan</span>
            <p style={{ fontSize: 'var(--text-lg)', color: 'var(--color-text)' }}>{selesai.versi_benar}</p>
            <p>Baca keras versi baru ini. Lebih enak, kan?</p>
          </div>
        </div>
      )}
      {!selesai && (
        <div className="baris">
          {onPetunjuk && meleset >= 3 && petunjuk.length === 0 && (
            <button type="button" className="btn-besar sekunder" onClick={mintaPetunjuk}>Minta petunjuk</button>
          )}
          {onBerhenti && (
            <button type="button" className="btn btn-ghost" onClick={berhenti}>Aku sudah selesai mencari</button>
          )}
        </div>
      )}
    </div>
  )
}
