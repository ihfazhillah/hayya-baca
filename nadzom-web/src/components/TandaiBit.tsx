import { useState } from 'react'
import type { Huruf } from '@/lib/jenis'
import { periksaTanda, teksKitabah } from '@/lib/latihan'
import Papan from './Papan'

interface Props {
  huruf: Huruf[]
  onBenar?: () => void
}

/** Latihan memberi tanda 1/0 per huruf. Ketuk berputar: kosong → 1 → 0 → kosong. */
export default function TandaiBit({ huruf, onBenar }: Props) {
  const [jawab, setJawab] = useState<(0 | 1 | null)[]>(() => huruf.map(() => null))
  const [periksa, setPeriksa] = useState<boolean[] | null>(null)
  const [lihat, setLihat] = useState(false)

  const ketuk = (i: number) => {
    setPeriksa(null)
    setJawab((j) => j.map((v, k) => (k !== i ? v : v === null ? 1 : v === 1 ? 0 : null)))
  }
  const cek = () => {
    const r = periksaTanda(huruf, jawab)
    setPeriksa(r)
    if (r.every(Boolean)) onBenar?.()
  }
  const benar = periksa?.filter(Boolean).length ?? 0
  const kosong = jawab.filter((v) => v === null).length

  return (
    <div className="tumpuk">
      <div className="papan">
        <div className="kitabah" lang="ar">{teksKitabah(huruf)}</div>
        {lihat
          ? <Papan huruf={huruf} tanda="muncul" />
          : <Papan huruf={huruf} jawab={jawab} onKetuk={ketuk} periksa={periksa} />}
      </div>
      {periksa && !lihat && (
        <div className={`pesan ${benar === huruf.length ? 'ok' : 'salah'}`}>
          {benar === huruf.length
            ? `Semua ${huruf.length} huruf benar.`
            : `${huruf.length - benar} huruf belum tepat (merah). Ingat: huruf mad dan huruf sukun = 0.`}
        </div>
      )}
      <div className="baris">
        {!lihat && (
          <button type="button" className="tombol utama" onClick={cek} disabled={kosong === huruf.length}>
            Periksa
          </button>
        )}
        {lihat ? (
          <button type="button" className="tombol" onClick={() => { setLihat(false); setJawab(huruf.map(() => null)); setPeriksa(null) }}>
            Coba lagi sendiri
          </button>
        ) : (
          <button type="button" className="tombol" onClick={() => setLihat(true)} disabled={!periksa}>
            Lihat jawaban
          </button>
        )}
        {!lihat && kosong > 0 && <span className="redup kecil">{kosong} huruf belum ditandai</span>}
      </div>
    </div>
  )
}
