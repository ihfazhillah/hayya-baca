import { useId, useState } from 'react'
import type { Tamrin } from '@/content/jenis'
import { kitabahBait } from '@/lib/kitabah'
import { cariBahr } from '@/lib/bahr'
import { timbangBait } from '@/lib/timbang'
import type { HasilBait } from '@/lib/jenis'
import Papan from './Papan'
import Teks from './Teks'
import SalinDiwan from './SalinDiwan'

type TamrinCetakan = Extract<Tamrin, { jenis: 'cetakan' }>

/** Isi kotak cetakan dengan kata sendiri; setiap baris ditimbang langsung. */
export default function Cetakan({ t }: { t: TamrinCetakan }) {
  const dasarId = useId()
  const bahr = cariBahr(t.bahr)!
  const [isi, setIsi] = useState<string[]>(() => t.kotak.map(() => ''))
  const [baris, setBaris] = useState<string[]>([])

  const susun = (nilai: string[]) => nilai.reduce((teks, v, i) => teks.replace(`{${i + 1}}`, v.trim() || '…'), t.cetakan)
  const lengkap = isi.every((v) => v.trim())
  const kalimat = susun(isi)
  const k = lengkap ? kitabahBait([kalimat]) : null
  const hasil: HasilBait | null = k?.ok ? timbangBait(k.syathr, bahr) : null
  const sudahAda = baris.includes(kalimat)
  const cukup = baris.length >= t.jumlah

  const simpan = () => {
    if (!hasil || hasil.patah > 0 || sudahAda) return
    setBaris([...baris, kalimat])
    setIsi(t.kotak.map(() => ''))
  }

  const semua = baris.length ? kitabahBait(baris.map((b) => b)) : null
  const hasilSemua = semua?.ok ? timbangBait(semua.syathr, bahr) : null

  return (
    <div className="tumpuk">
      <p><Teks>{t.petunjuk}</Teks></p>
      <div className="papan">
        <div className="papan-bait" lang="ar">{kalimat}</div>
        {hasil && <Papan huruf={hasil.syathr[0].huruf} kaki={hasil.syathr[0].potongan} tanda="tampil" mizan status />}
      </div>
      <div className="baris" style={{ alignItems: 'flex-start' }}>
        {t.kotak.map((kotak, i) => (
          <div className="isian" key={i} style={{ flex: '1 1 200px' }}>
            <label htmlFor={`${dasarId}-${i}`}>Kotak {i + 1}</label>
            <input
              id={`${dasarId}-${i}`}
              type="text"
              className="ar"
              dir="rtl"
              lang="ar"
              value={isi[i]}
              onChange={(e) => setIsi(isi.map((v, j) => (j === i ? e.target.value : v)))}
              placeholder={kotak.contoh[0]}
            />
            <span className="bantu">{kotak.petunjuk} · contoh: <span className="ar-in" lang="ar">{kotak.contoh.join('، ')}</span></span>
          </div>
        ))}
      </div>
      {k && !k.ok && <div className="pesan salah">{k.galat}</div>}
      {hasil && (
        <div className={`pesan ${hasil.patah === 0 ? (sudahAda ? 'info' : 'ok') : 'salah'}`}>
          {hasil.patah === 0
            ? sudahAda ? 'Baris ini sudah Anda simpan. Coba kata lain.' : 'Lurus, 0 patah. Simpan baris ini.'
            : `${hasil.patah} taf'ilah patah. ${hasil.syathr[0].potongan.find((p) => p.status === 'patah')?.catatan ?? ''}`}
        </div>
      )}
      <div className="baris">
        <button type="button" className="tombol utama" onClick={simpan} disabled={!hasil || hasil.patah > 0 || sudahAda}>Simpan baris</button>
        <span className={`chip ${cukup ? 'ok' : ''}`}>{baris.length} dari {t.jumlah} baris</span>
      </div>
      {baris.length > 0 && (
        <ol className="tumpuk-kecil" style={{ margin: 0, paddingInlineStart: 24 }}>
          {baris.map((b) => <li key={b}><span className="ar-in" lang="ar">{b}</span></li>)}
        </ol>
      )}
      {cukup && hasilSemua && <SalinDiwan bait={baris} hasil={hasilSemua} judulAwal="Cetakan ramal majzu'" />}
    </div>
  )
}
