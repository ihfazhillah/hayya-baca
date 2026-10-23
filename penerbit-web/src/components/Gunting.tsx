import { useMemo, useState } from 'react'
import type { HasilGunting, Token } from '../types'

/** Gunting: klik celah di antara kata untuk memasang garis potong, lalu Periksa.
 *  Setelah diperiksa: hijau = tepat, abu-abu = tidak perlu, garis putus ungu = yang terlewat. */
export default function Gunting({ tokens, onPeriksa, onSelesai }: {
  tokens: Token[]
  onPeriksa: (potong: number[]) => Promise<HasilGunting>
  onSelesai?: (h: HasilGunting) => void
}) {
  const [potong, setPotong] = useState<Set<number>>(() => new Set())
  const [hasil, setHasil] = useState<HasilGunting | null>(null)
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  /** Grup potongan wajib yang belum kena: tandai posisi pertamanya sebagai "terlewat". */
  const terlewat = useMemo(() => {
    const s = new Set<number>()
    if (!hasil?.potong) return s
    for (const grup of hasil.potong) {
      if (!grup.some((i) => hasil.tepat.includes(i)) && grup.length) s.add(grup[0])
    }
    return s
  }, [hasil])

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
    setGalat(null)
    try {
      const r = await onPeriksa([...potong].sort((a, b) => a - b))
      setHasil(r)
      onSelesai?.(r)
    } catch {
      setGalat('Belum tersambung. Coba tekan Periksa lagi, ya.')
    } finally {
      setSibuk(false)
    }
  }

  const kelas = (i: number) => {
    if (!hasil) return potong.has(i) ? ' potong' : ''
    if (hasil.tepat.includes(i)) return ' potong tepat'
    if (hasil.tidak_perlu.includes(i)) return ' potong tidak-perlu'
    if (terlewat.has(i)) return ' terlewat'
    return ''
  }

  return (
    <div className="tumpuk">
      <div className="teks-latihan" aria-label="Teks latihan">
        {tokens.map((t) =>
          t.j === 'spasi' ? (
            <button key={t.i} type="button" className={`celah spasi${kelas(t.i)}`} aria-pressed={potong.has(t.i)}
              aria-label={terlewat.has(t.i) ? 'potongan yang terlewat' : 'pasang garis potong di sini'}
              onClick={() => toggle(t.i)} disabled={!!hasil} />
          ) : (
            <span key={t.i}>{t.t}</span>
          ),
        )}
      </div>
      {galat && <p role="status" className="ph-pesan">{galat}</p>}
      {!hasil ? (
        <div className="baris">
          <button type="button" className="btn-besar" onClick={periksa} disabled={sibuk}>Periksa</button>
          <span className="kecil">{potong.size} garis potong</span>
        </div>
      ) : (
        <div className="tumpuk" role="status">
          <p>
            {hasil.benar} dari {hasil.total} potongan penting kamu temukan.
            {hasil.tidak_perlu.length > 0 && ` ${hasil.tidak_perlu.length} potongan abu-abu tidak perlu.`}
            {hasil.kurang > 0 && (terlewat.size > 0
              ? ` Garis putus-putus ungu menunjukkan ${hasil.kurang === 1 ? 'potongan' : `${hasil.kurang} potongan`} yang terlewat.`
              : ` Masih ada ${hasil.kurang} yang belum ditemukan.`)}
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
