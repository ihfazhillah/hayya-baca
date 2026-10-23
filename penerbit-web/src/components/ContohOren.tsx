import { useState } from 'react'
import type { LangkahContoh, Token } from '../types'

/** Contoh dari Oren (spec 075 K1): Oren memperagakan alat langkah demi langkah sambil berpikir
 *  keras. Anak menekan Lanjut per langkah; setelah langkah terakhir, giliran anak. */
export default function ContohOren({ tokens, langkah, onSelesai }: {
  tokens: Token[]
  langkah: LangkahContoh[]
  onSelesai: () => void
}) {
  const [ke, setKe] = useState(0)
  const x = langkah[ke]
  const sorot = new Set(x?.sorot ?? [])
  const terakhir = ke >= langkah.length - 1
  return (
    <section className="tumpuk contoh-oren" aria-label="Contoh dari Oren">
      <div className="teks-latihan">
        {tokens.map((t) => (
          <span key={t.i} className={sorot.has(t.i) ? 'sorot-oren' : undefined}>{t.t}</span>
        ))}
      </div>
      <div className="gelembung-oren" aria-live="polite">
        <span className="gelembung-oren-wajah" aria-hidden="true">🐱</span>
        <p>{x?.pikir}</p>
      </div>
      <div className="baris">
        <span className="kecil">Langkah {ke + 1} dari {langkah.length}</span>
        <button type="button" className="btn-besar" onClick={() => (terakhir ? onSelesai() : setKe(ke + 1))}>
          {terakhir ? 'Giliranku!' : 'Lanjut'}
        </button>
      </div>
    </section>
  )
}
