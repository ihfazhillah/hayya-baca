import { useMemo, useState } from 'react'
import type { JenisSalah, KodeBahr } from '@/content/jenis'
import { kitabahBait } from '@/lib/kitabah'
import { cariBahr } from '@/lib/bahr'
import { timbangBait } from '@/lib/timbang'
import Teks from './Teks'

interface Props {
  petunjuk: string
  bahr: KodeBahr
  baris: { bait: string[]; salah: JenisSalah | null; alasan: string }[]
}

const PILIHAN: { nilai: JenisSalah | 'benar'; label: string }[] = [
  { nilai: 'benar', label: 'Benar' },
  { nilai: "i'rab", label: "Salah i'rab" },
  { nilai: 'makna', label: 'Maknanya rusak' },
  { nilai: 'tema', label: 'Keluar tema' },
]

/** Fase E: semua baris lurus wazannya; mata kedua menilai i'rab, makna, dan tema yang tidak diperiksa mesin. */
export default function CariSalah({ petunjuk, bahr, baris }: Props) {
  const lurus = useMemo(() => baris.map((b) => {
    const k = kitabahBait(b.bait)
    return k.ok ? timbangBait(k.syathr, cariBahr(bahr)!).patah === 0 : false
  }), [baris, bahr])
  const [nilai, setNilai] = useState<string[]>(() => baris.map(() => ''))
  const [periksa, setPeriksa] = useState(false)
  const kunci = baris.map((b) => b.salah ?? 'benar')
  const tepat = nilai.filter((v, i) => v === kunci[i]).length

  return (
    <div className="tumpuk">
      <p><Teks>{petunjuk}</Teks></p>
      <ul className="bait-daftar">
        {baris.map((b, i) => (
          <li key={i} className={periksa ? (nilai[i] === kunci[i] ? 'ok' : 'salah') : ''}>
            <div className="baris-antara">
              <span className={`chip ${lurus[i] ? 'ok' : 'salah'}`}>{lurus[i] ? 'lurus' : 'patah'}</span>
              <select aria-label={`Penilaian baris ${i + 1}`} value={nilai[i]} onChange={(e) => { setPeriksa(false); setNilai(nilai.map((v, k) => (k === i ? e.target.value : v))) }}>
                <option value="">nilai baris ini</option>
                {PILIHAN.map((p) => <option key={p.nilai} value={p.nilai}>{p.label}</option>)}
              </select>
            </div>
            <div className="bait-teks" dir="rtl" lang="ar">{b.bait.map((s, k) => <span key={k}>{s}</span>)}</div>
            {periksa && <p className="redup kecil"><Teks>{b.alasan}</Teks></p>}
          </li>
        ))}
      </ul>
      <div className="baris">
        <button type="button" className="tombol utama" onClick={() => setPeriksa(true)} disabled={nilai.some((v) => !v)}>Periksa</button>
        {periksa && <span className={`chip ${tepat === baris.length ? 'ok' : 'salah'}`}>{tepat} dari {baris.length} tepat</span>}
      </div>
    </div>
  )
}
