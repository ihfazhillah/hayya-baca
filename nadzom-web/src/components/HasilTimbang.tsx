import { useState } from 'react'
import type { HasilBait } from '@/lib/jenis'
import { teksKitabah } from '@/lib/latihan'
import Papan from './Papan'
import SalinDiwan from './SalinDiwan'
import Irama from './Irama'

interface Props {
  hasil: HasilBait
  bait: string[]
  salin?: boolean
  judulDiwan?: string
}

/** Hasil timbangan: tiap syathr dipotong per taf'ilah, dengan status utuh/berubah/patah. */
export default function HasilTimbang({ hasil, bait, salin, judulDiwan }: Props) {
  const berubah = hasil.syathr.flatMap((s) => s.potongan).filter((p) => p.status === 'berubah').length
  const catatan = hasil.syathr.flatMap((s, si) =>
    s.potongan.filter((p) => p.status === 'patah').map((p) => ({ si, teks: p.catatan, kata: teksKitabah(s.huruf.slice(p.mulai, p.akhir)) })),
  )
  const pilihan = hasil.syathr.flatMap((s) => s.bacaanPilihan)
  const [dengar, setDengar] = useState(false)

  return (
    <div className="tumpuk">
      <div className="baris">
        <span className="chip">{hasil.bahr.nama}</span>
        <span className={`chip ${hasil.patah === 0 ? 'ok' : 'salah'}`}>Patah: {hasil.patah}</span>
        {berubah > 0 && <span className="chip">Berubah (sah): {berubah}</span>}
        <button type="button" className="tombol kecil" onClick={() => setDengar(!dengar)} aria-expanded={dengar}>
          {dengar ? 'Tutup irama' : 'Dengar irama'}
        </button>
      </div>
      {dengar && <Irama hasil={hasil} />}
      <div className="papan">
        {hasil.syathr.map((s, i) => (
          <div className="tumpuk-kecil" key={i} style={{ alignItems: 'center', width: '100%' }}>
            {hasil.syathr.length > 1 && <span className="label">Syathr {i + 1}</span>}
            <Papan huruf={s.huruf} kaki={s.potongan} tanda="tampil" mizan status />
          </div>
        ))}
      </div>
      {catatan.length > 0 && (
        <ul className="qaidah">
          {catatan.map((c, i) => (
            <li key={i}>
              <span className="segel" aria-hidden="true">!</span>
              <span>Syathr {c.si + 1}, <span className="ar-in" lang="ar">{c.kata}</span>: {c.teks}</span>
            </li>
          ))}
        </ul>
      )}
      {berubah > 0 && hasil.patah === 0 && (
        <p className="redup kecil">Taf'ilah "berubah" adalah zihaf atau 'illah yang sah, bukan pincang. Dibahas di Modul 3.</p>
      )}
      {pilihan.length > 0 && <p className="redup kecil">Dibaca dengan {pilihan.join(', ')} agar wazannya lurus.</p>}
      {salin && <SalinDiwan bait={bait} hasil={hasil} judulAwal={judulDiwan} />}
    </div>
  )
}
