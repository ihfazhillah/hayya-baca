import { Fragment, useMemo, useState } from 'react'
import type { Bantuan, HasilKlik, Jawaban, Target, Token } from '../types'

/** Keadaan percobaan yang dilanjutkan setelah halaman dimuat ulang.
 *  `ditemukan` dan `celah` opsional: server lama hanya mengirim token yang diklik. */
export interface AwalKlik {
  diklik: number[]
  meleset: number
  ditemukan?: number
  celah?: number[]
}

/** Klik Kesalahan (Pengeras Suara, Kaca Pembesar, Kamera di latihan).
 *  Penilaian di server: komponen hanya mengirim indeks token/celah yang diklik. */
export interface TeksKlikProps {
  tokens: Token[]
  celah?: boolean
  /** Jumlah kesalahan (hanya tahap petunjuk); dipakai penghitung sejak awal. */
  jumlah?: number
  awal?: AwalKlik
  onKlik: (target: { token?: number; celah?: number }) => Promise<HasilKlik>
  onPetunjuk?: () => Promise<{ kalimat: [number, number][] }>
  onBerhenti?: () => Promise<Jawaban & { selesai: true }>
  onSelesai?: (hasil: Jawaban & { hadiah_baru?: HasilKlik['hadiah_baru'] }) => void
  /** Bantuan memudar (spec 075): diisi hanya di misi yang memakainya; server memperbaruinya per klik. */
  bantuan?: Bantuan
}

const PESAN_MELESET = 'Bukan yang ini. Coba baca keras-keras sekali lagi.'
const PESAN_GAGAL = 'Belum tersambung. Coba klik lagi, ya.'

export default function TeksKlik({ tokens, celah = false, jumlah, awal, onKlik, onPetunjuk, onBerhenti, onSelesai, bantuan: bantuanAwal }: TeksKlikProps) {
  const [diklik, setDiklik] = useState<Set<number>>(() => new Set(awal?.diklik ?? []))
  const [celahKetemu, setCelahKetemu] = useState<Set<number>>(() => new Set(awal?.celah ?? []))
  const [ditemukan, setDitemukan] = useState(
    () => awal?.ditemukan ?? (awal ? awal.diklik.length + (awal.celah?.length ?? 0) : 0))
  const [total, setTotal] = useState<number | undefined>(jumlah)
  const [meleset, setMeleset] = useState(awal?.meleset ?? 0)
  const [goyang, setGoyang] = useState<number | null>(null)
  const [pesan, setPesan] = useState<string | null>(null)
  const [petunjuk, setPetunjuk] = useState<[number, number][]>([])
  const [selesai, setSelesai] = useState<(Jawaban & { selesai: true }) | null>(null)
  const [sibuk, setSibuk] = useState(false)
  const memudar = bantuanAwal !== undefined
  const [bantuan, setBantuan] = useState<Bantuan>(bantuanAwal ?? null)

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
      if (r.bantuan !== undefined) setBantuan(r.bantuan)
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
    } catch {
      setPesan(PESAN_GAGAL)
    } finally {
      setSibuk(false)
    }
  }

  async function mintaPetunjuk() {
    if (!onPetunjuk) return
    try {
      const r = await onPetunjuk()
      setPetunjuk(r.kalimat)
      setPesan('Ada kesalahan di kalimat yang kuning.')
    } catch (e) {
      setPesan(e instanceof Error ? e.message : PESAN_GAGAL)
    }
  }

  async function berhenti() {
    if (!onBerhenti || sibuk) return
    setSibuk(true)
    try {
      const r = await onBerhenti()
      setSelesai(r)
      onSelesai?.(r)
    } catch {
      setPesan(PESAN_GAGAL)
    } finally {
      setSibuk(false)
    }
  }

  const letak = !selesai && bantuan?.tingkat === 'letak' ? [bantuan.kalimat] : []
  const tunjuk = !selesai && bantuan?.tingkat === 'tunjuk' ? bantuan : null
  const diTunjuk = (i: number) => !!tunjuk?.token.includes(i)
  const diPetunjuk = (i: number) => [...petunjuk, ...letak].some(([a, b]) => i >= a && i <= b)
  const kelasPetunjuk = (i: number) => (diPetunjuk(i) ? 'kalimat-petunjuk' : undefined)

  return (
    <div className="tumpuk">
      <div className="teks-latihan" aria-label="Teks latihan">
        {tokens.map((t) => {
          const tombolCelah = celah && t.i > 0 && t.j !== 'spasi' && tokens[t.i - 1].j !== 'spasi'
          let isi
          if (t.j === 'spasi') {
            // Spasi hanya bisa diklik di mode celah (Kaca Pembesar: spasi berlebih).
            isi = celah ? (
              <button type="button" className={`kata tanda spasi${diklik.has(t.i) || kunciTerbuka.token.has(t.i) ? ' ditemukan' : ''}${diPetunjuk(t.i) ? ' kalimat-petunjuk' : ''}${diTunjuk(t.i) ? ' bantuan-tunjuk' : ''}${goyang === t.i ? ' meleset' : ''}`}
                aria-label="spasi" onClick={() => klik({ token: t.i })} disabled={!!selesai}>{' '}</button>
            ) : (
              <span className={kelasPetunjuk(t.i)}>{t.t}</span>
            )
          } else if (t.j === 'tanda' && !celah) {
            // Tanda baca tidak dinilai di luar mode celah: tampil sebagai teks biasa.
            isi = <span className={kelasPetunjuk(t.i)}>{t.t}</span>
          } else {
            isi = (
              <button
                type="button"
                className={[
                  'kata',
                  t.j === 'tanda' ? 'tanda' : '',
                  diklik.has(t.i) || kunciTerbuka.token.has(t.i) ? 'ditemukan' : '',
                  goyang === t.i ? 'meleset' : '',
                  diPetunjuk(t.i) ? 'kalimat-petunjuk' : '',
                  diTunjuk(t.i) ? 'bantuan-tunjuk' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => klik({ token: t.i })}
                disabled={!!selesai}
              >
                {t.t}
              </button>
            )
          }
          return (
            <Fragment key={t.i}>
              {tombolCelah && (
                <button
                  type="button"
                  className={`celah${celahKetemu.has(t.i) || kunciTerbuka.celah.has(t.i) ? ' ditemukan' : ''}${tunjuk?.celah === t.i ? ' bantuan-tunjuk' : ''}${goyang === -1 - t.i ? ' meleset' : ''}`}
                  aria-label={`celah sebelum ${t.t}`}
                  onClick={() => klik({ celah: t.i })}
                  disabled={!!selesai}
                />
              )}
              {isi}
            </Fragment>
          )
        })}
        {celah && (
          <button type="button" className={`celah${celahKetemu.has(tokens.length) || kunciTerbuka.celah.has(tokens.length) ? ' ditemukan' : ''}${tunjuk?.celah === tokens.length ? ' bantuan-tunjuk' : ''}`}
            aria-label="celah di akhir" onClick={() => klik({ celah: tokens.length })} disabled={!!selesai} />
        )}
      </div>
      {total !== undefined ? (
        <div className="penghitung" aria-live="polite">
          {ditemukan} dari {total} kesalahan ditemukan
          <div className="batang"><span style={{ width: `${total ? (ditemukan / total) * 100 : 0}%` }} /></div>
        </div>
      ) : ditemukan > 0 && (
        // Tahap tanpa petunjuk: jumlah kesalahan dirahasiakan sampai klik pertama berikutnya.
        <div className="penghitung" aria-live="polite">{ditemukan} kesalahan ditemukan</div>
      )}
      {memudar && !selesai && (
        <div role="note" aria-label="Bantuan Oren" className="bantuan-oren">
          <span aria-hidden="true">🐱</span>
          <p>
            {tunjuk ? <>Lihat yang bersinar. {tunjuk.alasan} Klik di situ.</>
              : letak.length ? 'Ada kesalahan di kalimat yang kuning. Coba cari, ya.'
                : 'Sekarang cari sendiri, ya. Kamu pasti bisa!'}
          </p>
        </div>
      )}
      {pesan && !selesai && <p role="status" className="ph-pesan">{pesan}</p>}
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
            <button type="button" className="btn btn-ghost" onClick={berhenti} disabled={sibuk}>Aku sudah selesai mencari</button>
          )}
        </div>
      )}
    </div>
  )
}
