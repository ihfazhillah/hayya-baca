import { useMemo, useState } from 'react'
import type { HasilKembar, Token } from '../types'

/** Detektor Kembar: klik satu kata, semua kata yang sama ikut menyala. */
export default function DetektorKembar({ tokens, kataUmum, onPeriksa, onSelesai }: {
  tokens: Token[]
  kataUmum: string[]
  onPeriksa: (kata: string) => Promise<HasilKembar>
  onSelesai?: (h: HasilKembar) => void
}) {
  const [pilih, setPilih] = useState<string | null>(null)
  const [pesan, setPesan] = useState<string | null>(null)
  const [hasil, setHasil] = useState<HasilKembar | null>(null)
  const umum = useMemo(() => new Set(kataUmum), [kataUmum])
  const hitung = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of tokens) if (t.j === 'kata') m.set(t.t.toLowerCase(), (m.get(t.t.toLowerCase()) ?? 0) + 1)
    return m
  }, [tokens])

  async function periksa() {
    if (!pilih) return
    const r = await onPeriksa(pilih)
    if (r.hasil === 'benar') {
      setHasil(r)
      onSelesai?.(r)
    } else {
      setPesan('Hmm, ada kata lain yang lebih sering muncul. Coba klik kata lain.')
    }
  }

  return (
    <div className="tumpuk">
      <div className="teks-latihan" aria-label="Teks latihan">
        {tokens.map((t) =>
          t.j === 'kata' ? (
            <button key={t.i} type="button"
              className={`kata${pilih && t.t.toLowerCase() === pilih ? ' nyala' : ''}`}
              onClick={() => { setPilih(t.t.toLowerCase()); setPesan(null) }} disabled={!!hasil}>
              {t.t}
            </button>
          ) : (
            <span key={t.i}>{t.t}</span>
          ),
        )}
      </div>
      {pilih && !hasil && (
        <p role="status">
          {umum.has(pilih)
            ? `"${pilih}" kata umum, tidak dihitung.`
            : `"${pilih}" muncul ${hitung.get(pilih)} kali.`}
        </p>
      )}
      {pesan && <p role="status">{pesan}</p>}
      {!hasil ? (
        <button type="button" className="btn-besar" onClick={periksa} disabled={!pilih || umum.has(pilih ?? '')}>
          Ini kata kembarnya!
        </button>
      ) : (
        <div className="callout callout-accent"><div className="callout-content">
          <span className="callout-title">Ketemu kata kembarnya!</span>
          {hasil.pengganti && hasil.pengganti.length > 0 && <p>Pengganti yang bisa dipakai: {hasil.pengganti.join(', ')}.</p>}
        </div></div>
      )}
    </div>
  )
}
