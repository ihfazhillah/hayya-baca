import { useId, useState } from 'react'
import type { Tamrin } from '@/content/jenis'
import { BANK_KATA } from '@/content'
import { kitabahBait, pisahBait } from '@/lib/kitabah'
import { cariBahr } from '@/lib/bahr'
import { timbangBait } from '@/lib/timbang'
import type { HasilBait } from '@/lib/jenis'
import Teks from './Teks'
import HasilTimbang from './HasilTimbang'

type TamrinSusun = Extract<Tamrin, { jenis: 'susun' }>

export const JALUR = ['Makna', 'Qafiyah', 'Susun', 'Lagukan', "Taqthi'", 'Perbaiki', 'Diwan'] as const

/** Bank kata dengan pola bit-nya. */
export function BankKata() {
  return (
    <div className="tabel-wrap">
      <table>
        <thead><tr><th>Kata</th><th>Pola</th><th>Arti</th></tr></thead>
        <tbody>
          {BANK_KATA.map((k) => {
            const r = kitabahBait([k.teks], { tanpaAkhir: true })
            return (
              <tr key={k.teks}>
                <td className="ar" lang="ar">{k.teks}</td>
                <td className="bit">{r.ok ? r.syathr[0].map((h) => h.bit).join('') : ''}</td>
                <td>{k.arti}{k.catatan && <div className="redup kecil"><Teks>{k.catatan}</Teks></div>}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Menyusun bait sendiri lewat tujuh tahap; setiap timbangan menjadi satu versi. */
export default function Susun({ t }: { t: TamrinSusun }) {
  const id = useId()
  const bahr = cariBahr(t.bahr)!
  const [centang, setCentang] = useState<boolean[]>(() => JALUR.map(() => false))
  const [teks, setTeks] = useState('')
  const [versi, setVersi] = useState<{ bait: string[]; hasil: HasilBait }[]>([])
  const [galat, setGalat] = useState('')
  const [bank, setBank] = useState(false)

  const timbang = () => {
    const bait = pisahBait(teks)
    const k = kitabahBait(bait)
    if (!k.ok) {
      setGalat(k.galat)
      return
    }
    setGalat('')
    setVersi([...versi, { bait, hasil: timbangBait(k.syathr, bahr) }])
    setCentang((c) => c.map((v, i) => v || JALUR[i] === "Taqthi'"))
  }
  const akhir = versi.at(-1)

  return (
    <div className="tumpuk">
      <p><Teks>{t.petunjuk}</Teks></p>
      <p className="redup"><Teks>{t.makna}</Teks></p>
      <div className="baris" role="group" aria-label="Tujuh tahap">
        {JALUR.map((j, i) => (
          <label key={j} className={`chip ${centang[i] ? 'ok' : ''}`} style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={centang[i]} onChange={() => setCentang(centang.map((v, k) => (k === i ? !v : v)))} style={{ margin: 0 }} />
            {i + 1}. {j}
          </label>
        ))}
      </div>
      <div className="isian">
        <label htmlFor={id}>Bait Anda (dua syathr, satu per baris)</label>
        <textarea id={id} className="ar" dir="rtl" lang="ar" rows={3} value={teks} onChange={(e) => setTeks(e.target.value)} placeholder="syathr pertama&#10;syathr kedua" />
        <span className="bantu">Tulis lengkap dengan harakat. Pemisah syathr: baris baru atau tanda |.</span>
      </div>
      <div className="baris">
        <button type="button" className="tombol utama" onClick={timbang} disabled={!teks.trim()}>Timbang</button>
        {t.bankKata && <button type="button" className="tombol" onClick={() => setBank(!bank)} aria-expanded={bank}>{bank ? 'Tutup bank kata' : 'Buka bank kata'}</button>}
      </div>
      {bank && <BankKata />}
      {galat && <div className="pesan salah">{galat}</div>}
      {versi.length > 0 && (
        <div className="kartu kartu-tipis">
          <span className="label">Versi</span>
          <ul className="versi">
            {versi.map((v, i) => (
              <li key={i}>
                <span className="chip">v{i + 1}</span>
                <span className={`chip ${v.hasil.patah === 0 ? 'ok' : 'salah'}`}>patah {v.hasil.patah}</span>
                <span className="ar-in" lang="ar" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.bait[0]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {akhir && <HasilTimbang key={versi.length} hasil={akhir.hasil} bait={akhir.bait} salin judulDiwan={`Bait #1 v${versi.length}`} />}
    </div>
  )
}
