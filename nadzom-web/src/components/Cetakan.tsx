import { useId, useState } from 'react'
import type { Tamrin } from '@/content/jenis'
import { kitabahBait } from '@/lib/kitabah'
import { cariBahr } from '@/lib/bahr'
import { belumUtuh, timbangBait } from '@/lib/timbang'
import type { HasilBait } from '@/lib/jenis'
import Papan from './Papan'
import Teks from './Teks'
import SalinDiwan from './SalinDiwan'
import Laci from './Laci'
import { useJilid } from './Jilid'

type TamrinCetakan = Extract<Tamrin, { jenis: 'cetakan' }>

/** Isi kotak cetakan dengan kata sendiri; setiap baris ditimbang langsung. */
export default function Cetakan({ t }: { t: TamrinCetakan }) {
  const dasarId = useId()
  const bahr = cariBahr(t.bahr)!
  const [isi, setIsi] = useState<string[]>(() => t.kotak.map(() => ''))
  const [baris, setBaris] = useState<string[]>([])
  const [bank, setBank] = useState(false)
  const { salim, modul } = useJilid()

  const susun = (nilai: string[]) => nilai.reduce((teks, v, i) => teks.replace(`{${i + 1}}`, v.trim() || '…'), t.cetakan)
  const lengkap = isi.every((v) => v.trim())
  const kalimat = susun(isi)
  const k = lengkap ? kitabahBait([kalimat]) : null
  const hasil: HasilBait | null = k?.ok ? timbangBait(k.syathr, bahr) : null
  const sudahAda = baris.includes(kalimat)
  const belum = salim && hasil ? belumUtuh(hasil) : []
  const lulus = !!hasil && hasil.patah === 0 && belum.length === 0
  const cukup = baris.length >= t.jumlah

  const simpan = () => {
    if (!lulus || sudahAda) return
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
        <div className={`pesan ${lulus ? (sudahAda ? 'info' : 'ok') : 'salah'}`}>
          {hasil.patah > 0
            ? `${hasil.patah} taf'ilah patah. ${hasil.syathr[0].potongan.find((p) => p.status === 'patah')?.catatan ?? ''}`
            : belum.length > 0
              ? `Lurus, tetapi taf'ilah ${belum.map((b) => `${b.ke + 1} (${b.bit})`).join(', ')} belum utuh. Di Jilid 1 setiap taf'ilah harus ${belum[0].utuh.nama} (${belum[0].utuh.bit}).`
              : sudahAda ? 'Baris ini sudah Anda simpan. Coba kata lain.' : 'Lurus, 0 patah. Simpan baris ini.'}
        </div>
      )}
      <div className="baris">
        <button type="button" className="tombol utama" onClick={simpan} disabled={!lulus || sudahAda}>Simpan baris</button>
        <button type="button" className="tombol" onClick={() => setBank(!bank)} aria-expanded={bank}>{bank ? 'Tutup laci' : 'Buka laci kata'}</button>
        <span className={`chip ${cukup ? 'ok' : ''}`}>{baris.length} dari {t.jumlah} baris</span>
      </div>
      {bank && <Laci sampai={modul} bahr={modul === undefined ? undefined : t.bahr} />}
      {baris.length > 0 && (
        <ol className="tumpuk-kecil" style={{ margin: 0, paddingInlineStart: 24 }}>
          {baris.map((b) => <li key={b}><span className="ar-in" lang="ar">{b}</span></li>)}
        </ol>
      )}
      {cukup && hasilSemua && <SalinDiwan bait={baris} hasil={hasilSemua} judulAwal={`Cetakan ${bahr.nama}`} />}
    </div>
  )
}
