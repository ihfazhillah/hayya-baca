import { useMemo, useState } from 'react'
import type { KodeBahr } from '@/content/jenis'
import { kitabahBait } from '@/lib/kitabah'
import { cariBahr } from '@/lib/bahr'
import { timbangBait } from '@/lib/timbang'
import HasilTimbang from './HasilTimbang'
import Teks from './Teks'

interface Props {
  petunjuk: string
  bahr: KodeBahr
  baris: { bait: string[]; catatan?: string }[]
}

/** Dengar dengan telinga dulu: centang baris yang pincang, lalu periksa dengan timbangan. */
export default function CariPincang({ petunjuk, bahr, baris }: Props) {
  const hasil = useMemo(() => baris.map((b) => {
    const k = kitabahBait(b.bait)
    return k.ok ? timbangBait(k.syathr, cariBahr(bahr)!) : null
  }), [baris, bahr])
  const [pilih, setPilih] = useState<boolean[]>(() => baris.map(() => false))
  const [periksa, setPeriksa] = useState(false)
  const [buka, setBuka] = useState<number | null>(null)
  const pincang = hasil.map((h) => (h ? h.patah > 0 : false))
  const tepat = pilih.filter((p, i) => p === pincang[i]).length

  return (
    <div className="tumpuk">
      <p><Teks>{petunjuk}</Teks></p>
      <ul className="bait-daftar">
        {baris.map((b, i) => {
          const status = periksa ? (pilih[i] === pincang[i] ? 'ok' : 'salah') : ''
          return (
            <li key={i} className={status}>
              <div className="baris-antara">
                <label className="centang-label">
                  <input type="checkbox" checked={pilih[i]} onChange={() => { setPeriksa(false); setPilih(pilih.map((v, k) => (k === i ? !v : v))) }} />
                  Pincang
                </label>
                {periksa && (
                  <span className="baris">
                    <span className={`chip ${pincang[i] ? 'salah' : 'ok'}`}>{pincang[i] ? `patah ${hasil[i]?.patah}` : 'lurus'}</span>
                    <button type="button" className="tombol kecil" onClick={() => setBuka(buka === i ? null : i)} aria-expanded={buka === i}>
                      {buka === i ? 'Tutup' : 'Lihat timbangan'}
                    </button>
                  </span>
                )}
              </div>
              <div className="bait-teks" dir="rtl" lang="ar">{b.bait.map((s, k) => <span key={k}>{s}</span>)}</div>
              {periksa && b.catatan && <p className="redup kecil"><Teks>{b.catatan}</Teks></p>}
              {periksa && buka === i && hasil[i] && <HasilTimbang hasil={hasil[i]!} bait={b.bait} />}
            </li>
          )
        })}
      </ul>
      <div className="baris">
        <button type="button" className="tombol utama" onClick={() => setPeriksa(true)}>Periksa</button>
        {periksa && (
          <span className={`chip ${tepat === baris.length ? 'ok' : 'salah'}`}>{tepat} dari {baris.length} tepat</span>
        )}
      </div>
    </div>
  )
}
