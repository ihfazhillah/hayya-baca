import { useId, useState } from 'react'
import type { KotakCetakan, Tamrin } from '@/content/jenis'
import { kitabahBait } from '@/lib/kitabah'
import { cariBahr } from '@/lib/bahr'
import { belumUtuh, timbangBait } from '@/lib/timbang'
import { diwanMarkdown } from '@/lib/latihan'
import { KEADAAN, NAMA_HARAKAT, PERAN, harakatAkhir } from '@/lib/irab'
import type { HasilBait } from '@/lib/jenis'
import Papan from './Papan'
import Teks from './Teks'
import SalinDiwan from './SalinDiwan'
import Laci from './Laci'
import { useJilid } from './Jilid'

type TamrinCetakan = Extract<Tamrin, { jenis: 'cetakan' }>

/** Fase E: masalah satu kotak di luar wazan (pilihan, peran, harakat akhir). Kosong = sesuai. */
function masalahKotak(k: KotakCetakan, isi: string, peran: string, ke: number): string[] {
  const v = isi.trim()
  const m: string[] = []
  const tolak = k.tolak?.find((x) => x.kata === v)
  if (tolak) m.push(`Kotak ${ke}: ${tolak.alasan}`)
  else if (k.terima && !k.terima.includes(v)) m.push(`Kotak ${ke}: kata ini belum termasuk jawaban yang diterima untuk makna ini. Pilih dari daftar.`)
  if (k.harakat) {
    const h = harakatAkhir(v)
    if (h && h !== k.harakat) m.push(`Kotak ${ke}: lurus, tetapi harakat akhirnya ${NAMA_HARAKAT[h]}; ${k.peran ?? 'kata'} di sini ${KEADAAN[k.harakat]}, harakat akhirnya ${NAMA_HARAKAT[k.harakat]}.`)
  }
  if (k.peran) {
    if (!peran) m.push(`Kotak ${ke}: tentukan peran kata ini.`)
    else if (peran !== k.peran) m.push(`Kotak ${ke}: Peran kotak ini ${k.peran}, bukan ${peran}.`)
  }
  return m
}

/** Isi kotak cetakan dengan kata sendiri; setiap baris ditimbang langsung, lalu (Fase E) diperiksa jenis, peran, dan artinya. */
export default function Cetakan({ t }: { t: TamrinCetakan }) {
  const dasarId = useId()
  const bahr = cariBahr(t.bahr)!
  const [isi, setIsi] = useState<string[]>(() => t.kotak.map(() => ''))
  const [peran, setPeran] = useState<string[]>(() => t.kotak.map(() => ''))
  const [arti, setArti] = useState('')
  const [baris, setBaris] = useState<{ teks: string; arti: string }[]>([])
  const [bank, setBank] = useState(false)
  const { salim, modul } = useJilid()

  const susun = (nilai: string[]) => nilai.reduce((teks, v, i) => teks.replace(`{${i + 1}}`, v.trim() || '…'), t.cetakan)
  const lengkap = isi.every((v) => v.trim())
  const kalimat = susun(isi)
  const k = lengkap ? kitabahBait([kalimat]) : null
  const hasil: HasilBait | null = k?.ok ? timbangBait(k.syathr, bahr) : null
  const sudahAda = baris.some((b) => b.teks === kalimat)
  const belum = salim && hasil ? belumUtuh(hasil) : []
  const lurus = !!hasil && hasil.patah === 0 && belum.length === 0
  const masalah = lengkap ? t.kotak.flatMap((kt, i) => masalahKotak(kt, isi[i], peran[i], i + 1)) : []
  const kurangArti = !!t.arti && !arti.trim()
  const lulus = lurus && masalah.length === 0 && !kurangArti
  const cukup = baris.length >= t.jumlah

  const simpan = () => {
    if (!lulus || sudahAda) return
    setBaris([...baris, { teks: kalimat, arti: arti.trim() }])
    setIsi(t.kotak.map(() => ''))
    setPeran(t.kotak.map(() => ''))
    setArti('')
  }

  const semua = baris.length ? kitabahBait(baris.map((b) => b.teks)) : null
  const hasilSemua = semua?.ok ? timbangBait(semua.syathr, bahr) : null
  const md = (judul: string) =>
    diwanMarkdown(judul, baris.map((b) => b.teks), hasilSemua!) + baris.filter((b) => b.arti).map((b) => `- Arti: ${b.arti}\n`).join('')

  return (
    <div className="tumpuk">
      <p><Teks>{t.petunjuk}</Teks></p>
      {t.makna && <div className="pesan info">Sasaran makna: <Teks>{t.makna}</Teks></div>}
      <div className="papan">
        <div className="papan-bait" lang="ar">{kalimat}</div>
        {hasil && <Papan huruf={hasil.syathr[0].huruf} kaki={hasil.syathr[0].potongan} tanda="tampil" mizan status />}
      </div>
      <div className="baris" style={{ alignItems: 'flex-start' }}>
        {t.kotak.map((kotak, i) => {
          const pilihan = kotak.pilih ? [...(kotak.terima ?? []), ...(kotak.tolak ?? []).map((x) => x.kata)].sort() : []
          return (
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
              <span className="bantu">
                {kotak.jenis && <>{kotak.jenis} · </>}
                {kotak.petunjuk} · contoh: <span className="ar-in" lang="ar">{kotak.contoh.join('، ')}</span>
              </span>
              {pilihan.length > 0 && (
                <div className="baris" style={{ gap: 'var(--s-2)' }} role="group" aria-label={`Pilihan kotak ${i + 1}`}>
                  {pilihan.map((p) => (
                    <button key={p} type="button" className="tombol kecil" lang="ar" onClick={() => setIsi(isi.map((v, j) => (j === i ? p : v)))}>{p}</button>
                  ))}
                </div>
              )}
              {kotak.peran && (
                <>
                  <label htmlFor={`${dasarId}-${i}-peran`} className="bantu">Peran kata di kotak {i + 1}</label>
                  <select id={`${dasarId}-${i}-peran`} value={peran[i]} onChange={(e) => setPeran(peran.map((v, j) => (j === i ? e.target.value : v)))}>
                    <option value="">pilih peran</option>
                    {PERAN.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </>
              )}
            </div>
          )
        })}
      </div>
      {t.arti && (
        <div className="isian">
          <label htmlFor={`${dasarId}-arti`}>Arti baris ini</label>
          <input id={`${dasarId}-arti`} type="text" value={arti} onChange={(e) => setArti(e.target.value)} placeholder="Tulis artinya dalam bahasa Indonesia" />
          <span className="bantu">Baris yang tidak bisa Anda terjemahkan belum menjadi kalimat.</span>
        </div>
      )}
      {k && !k.ok && <div className="pesan salah">{k.galat}</div>}
      {hasil && (
        <div className={`pesan ${lulus ? (sudahAda ? 'info' : 'ok') : 'salah'}`}>
          {hasil.patah > 0
            ? `${hasil.patah} taf'ilah patah. ${hasil.syathr[0].potongan.find((p) => p.status === 'patah')?.catatan ?? ''}`
            : belum.length > 0
              ? `Lurus, tetapi taf'ilah ${belum.map((b) => `${b.ke + 1} (${b.bit})`).join(', ')} belum utuh. Di Jilid 1 setiap taf'ilah harus ${belum[0].utuh.nama} (${belum[0].utuh.bit}).`
              : masalah.length > 0
                ? <ul className="pesan-daftar">{masalah.map((m) => <li key={m}>{m}</li>)}</ul>
                : kurangArti
                  ? 'Lurus dan sesuai. Tulis artinya dulu, lalu simpan.'
                  : sudahAda ? 'Baris ini sudah Anda simpan. Coba kata lain.' : 'Lurus, 0 patah. Simpan baris ini.'}
        </div>
      )}
      <div className="baris">
        <button type="button" className="tombol utama" onClick={simpan} disabled={!lulus || sudahAda}>Simpan baris</button>
        <button type="button" className="tombol" onClick={() => setBank(!bank)} aria-expanded={bank}>{bank ? 'Tutup laci' : 'Buka laci kata'}</button>
        <span className={`chip ${cukup ? 'ok' : ''}`}>{baris.length} dari {t.jumlah} baris</span>
      </div>
      {bank && <Laci sampai={modul} bahr={modul === undefined ? undefined : t.bahr} tema={t.tema} />}
      {baris.length > 0 && (
        <ol className="tumpuk-kecil" style={{ margin: 0, paddingInlineStart: 24 }}>
          {baris.map((b) => (
            <li key={b.teks}>
              <span className="ar-in" lang="ar">{b.teks}</span>
              {b.arti && <span className="redup kecil"> · {b.arti}</span>}
            </li>
          ))}
        </ol>
      )}
      {cukup && hasilSemua && <SalinDiwan buatMd={md} judulAwal={`Cetakan ${bahr.nama}`} />}
    </div>
  )
}
