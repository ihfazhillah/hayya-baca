import { useState } from 'react'
import type { HasilGunting, Token } from '../types'

/** Gunting: klik spasi untuk memasang garis potong, lalu Periksa. */
export default function Gunting({ tokens, onPeriksa, onSelesai }: {
  tokens: Token[]
  onPeriksa: (potong: number[]) => Promise<HasilGunting>
  onSelesai?: (h: HasilGunting) => void
}) {
  const [potong, setPotong] = useState<Set<number>>(() => new Set())
  const [hasil, setHasil] = useState<HasilGunting | null>(null)
  const [sibuk, setSibuk] = useState(false)

  function toggle(i: number) {
    if (hasil) return
    setPotong((s) => {
      const n = new Set(s)
      if (n.has(i)) n.delete(i)
      else n.add(i)
      return n
    })
  }

  async function periksa() {
    setSibuk(true)
    try {
      const r = await onPeriksa([...potong].sort((a, b) => a - b))
      setHasil(r)
      onSelesai?.(r)
    } finally {
      setSibuk(false)
    }
  }

  const kelas = (i: number) => {
    if (!hasil) return potong.has(i) ? ' potong' : ''
    if (hasil.tepat.includes(i)) return ' potong tepat'
    if (hasil.tidak_perlu.includes(i)) return ' potong tidak-perlu'
    return ''
  }

  return (
    <div className="tumpuk">
      <div className="teks-latihan" aria-label="Teks latihan">
        {tokens.map((t) =>
          t.j === 'spasi' ? (
            <button key={t.i} type="button" className={`celah${kelas(t.i)}`} aria-pressed={potong.has(t.i)}
              aria-label="pasang garis potong di sini" onClick={() => toggle(t.i)} />
          ) : (
            <span key={t.i}>{t.t}</span>
          ),
        )}
      </div>
      {!hasil ? (
        <button type="button" className="btn-besar" onClick={periksa} disabled={sibuk}>Periksa</button>
      ) : (
        <div className="tumpuk" role="status">
          <p>
            {hasil.benar} dari {hasil.total} potongan penting kamu temukan.
            {hasil.tidak_perlu.length > 0 && ` ${hasil.tidak_perlu.length} potongan abu-abu tidak perlu.`}
            {hasil.kurang > 0 && ` Masih ada ${hasil.kurang} yang belum ditemukan.`}
          </p>
          {hasil.versi_benar && (
            <div className="callout callout-accent"><div className="callout-content">
              <span className="callout-title">Setelah digunting</span>
              <p style={{ fontSize: 'var(--text-lg)', color: 'var(--color-text)' }}>{hasil.versi_benar}</p>
            </div></div>
          )}
        </div>
      )}
    </div>
  )
}
