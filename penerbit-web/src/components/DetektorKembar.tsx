import { useMemo, useState } from 'react'
import type { Bantuan, HasilKembar, Token } from '../types'

/** Detektor Kembar: klik satu kata, semua kata yang sama ikut menyala.
 *  `bantuan` (spec 075 Fase B): "tunjuk" = kata kembar bersinar + alasan; "hitung" = jumlahnya saja. */
export default function DetektorKembar({ tokens, kataUmum, onPeriksa, onSelesai, bantuan }: {
  tokens: Token[]
  kataUmum: string[]
  onPeriksa: (kata: string) => Promise<HasilKembar>
  onSelesai?: (h: HasilKembar) => void
  bantuan?: Bantuan
}) {
  const [pilih, setPilih] = useState<string | null>(null)
  const [pesan, setPesan] = useState<string | null>(null)
  const [hasil, setHasil] = useState<HasilKembar | null>(null)
  const [sibuk, setSibuk] = useState(false)
  const umum = useMemo(() => new Set(kataUmum), [kataUmum])
  const hitung = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of tokens) if (t.j === 'kata') m.set(t.t.toLowerCase(), (m.get(t.t.toLowerCase()) ?? 0) + 1)
    return m
  }, [tokens])

  async function periksa() {
    if (!pilih || sibuk) return
    setSibuk(true)
    try {
      const r = await onPeriksa(pilih)
      if (r.hasil === 'benar') {
        setHasil(r)
        onSelesai?.(r)
      } else {
        setPesan('Hmm, ada kata lain yang lebih sering muncul. Coba klik kata lain.')
      }
    } catch {
      setPesan('Belum tersambung. Coba tekan lagi, ya.')
    } finally {
      setSibuk(false)
    }
  }

  const kataKembar = hasil?.kata?.length ? hasil.kata : pilih ? [pilih] : []
  const tunjuk = !hasil && bantuan?.tingkat === 'tunjuk' ? bantuan : null
  const hitungan = !hasil && bantuan?.tingkat === 'hitung' ? bantuan : null

  return (
    <div className="tumpuk">
      <div className="teks-latihan" aria-label="Teks latihan">
        {tokens.map((t) =>
          t.j === 'kata' ? (
            <button key={t.i} type="button"
              className={`kata${pilih && t.t.toLowerCase() === pilih ? ' nyala' : ''}${tunjuk?.token.includes(t.i) ? ' bantuan-tunjuk' : ''}`}
              onClick={() => { setPilih(t.t.toLowerCase()); setPesan(null) }} disabled={!!hasil}>
              {t.t}
            </button>
          ) : (
            <span key={t.i}>{t.t}</span>
          ),
        )}
      </div>
      {(tunjuk || hitungan) && (
        <div role="note" aria-label="Bantuan Oren" className="bantuan-oren">
          <span aria-hidden="true">🐱</span>
          <p>
            {tunjuk ? <>Lihat kata yang bersinar. {tunjuk.alasan}</>
              : <>Ada kata yang muncul {hitungan!.jumlah} kali. Klik kata-kata untuk menghitungnya.</>}
          </p>
        </div>
      )}
      {pilih && !hasil && (
        <p role="status" className="ph-pesan">
          {umum.has(pilih)
            ? `"${pilih}" kata umum, tidak dihitung.`
            : `"${pilih}" muncul ${hitung.get(pilih)} kali.`}
        </p>
      )}
      {pesan && <p role="status" className="ph-pesan">{pesan}</p>}
      {!hasil ? (
        <button type="button" className="btn-besar" onClick={periksa} disabled={!pilih || umum.has(pilih ?? '') || sibuk}>
          Ini kata kembarnya!
        </button>
      ) : (
        <div className="callout callout-accent"><div className="callout-content">
          <span className="callout-title">Ketemu kata kembarnya!</span>
          {kataKembar.length > 0 && <p>Kata kembarnya: <strong>{kataKembar.join(', ')}</strong>.</p>}
          {hasil.pengganti && hasil.pengganti.length > 0 && <p>Pengganti yang bisa dipakai: {hasil.pengganti.join(', ')}.</p>}
          {hasil.versi_benar && (
            <>
              <p>Setelah kata kembarnya diganti:</p>
              <p style={{ fontSize: 'var(--text-lg)', color: 'var(--color-text)' }}>{hasil.versi_benar}</p>
            </>
          )}
        </div></div>
      )}
    </div>
  )
}
