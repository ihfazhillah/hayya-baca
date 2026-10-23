import { useId, useState } from 'react'
import type { Tamrin } from '@/content/jenis'
import { kitabahBait } from '@/lib/kitabah'
import { cariBahr } from '@/lib/bahr'
import { timbangBait } from '@/lib/timbang'
import { diwanQasidah, pisahQasidah } from '@/lib/latihan'
import { periksaDharb, periksaQafiyah, type MasalahQafiyah } from '@/lib/qafiyah'
import type { HasilBait, Huruf } from '@/lib/jenis'
import Teks from './Teks'
import HasilTimbang from './HasilTimbang'
import SalinDiwan from './SalinDiwan'
import Laci from './Laci'

type TamrinSusun = Extract<Tamrin, { jenis: 'susun' }>

export const JALUR = ['Makna', 'Qafiyah', 'Susun', 'Lagukan', "Taqthi'", 'Perbaiki', 'Diwan'] as const

interface Versi {
  bait: string[][]
  hasil: HasilBait[]
  qafiyah: MasalahQafiyah[]
}

/** Menyusun bait sendiri lewat tujuh tahap; setiap timbangan menjadi satu versi. Bisa satu bait atau beberapa. */
export default function Susun({ t }: { t: TamrinSusun }) {
  const id = useId()
  const bahr = cariBahr(t.bahr)!
  const jumlah = t.jumlah ?? 1
  const banyak = jumlah > 1
  const [centang, setCentang] = useState<boolean[]>(() => JALUR.map(() => false))
  const [teks, setTeks] = useState('')
  const [versi, setVersi] = useState<Versi[]>([])
  const [galat, setGalat] = useState('')
  const [bank, setBank] = useState(false)
  const [buka, setBuka] = useState<number | null>(null)

  const timbang = () => {
    const bait = banyak ? pisahQasidah(teks) : [pisahQasidah(teks).flat()]
    const syathr: Huruf[][][] = []
    for (const [i, b] of bait.entries()) {
      const k = kitabahBait(b)
      if (!k.ok) {
        setGalat(banyak ? `Bait ${i + 1}: ${k.galat}` : k.galat)
        return
      }
      syathr.push(k.syathr)
    }
    setGalat('')
    setBuka(null)
    const hasil = syathr.map((s) => timbangBait(s, bahr))
    const qafiyah = banyak && t.qafiyah ? periksaQafiyah(syathr, t.qafiyah) : []
    if (banyak && t.qafiyah === 'satu') qafiyah.push(...periksaDharb(hasil))
    setVersi([...versi, { bait, hasil, qafiyah }])
    setCentang((c) => c.map((v, i) => v || JALUR[i] === "Taqthi'"))
  }
  const akhir = versi.at(-1)
  const patahTotal = (v: Versi) => v.hasil.reduce((a, h) => a + h.patah, 0)
  const judulDiwan = t.judulDiwan ?? (banyak ? `Qasidah ${bahr.nama}` : 'Bait #1')

  return (
    <div className="tumpuk">
      <p><Teks>{t.petunjuk}</Teks></p>
      <p className="redup"><Teks>{t.makna}</Teks></p>
      {t.rancangan && (
        <ol className="rancangan">
          {t.rancangan.map((r, i) => {
            const selesai = akhir && i < akhir.bait.length && akhir.hasil[i]?.patah === 0
            return (
              <li key={i}>
                <Teks>{r}</Teks> {selesai && <span className="chip ok">lurus</span>}
              </li>
            )
          })}
        </ol>
      )}
      <div className="baris" role="group" aria-label="Tujuh tahap" style={{ gap: 'var(--s-2)' }}>
        {JALUR.map((j, i) => (
          <label key={j} className={`chip tahap${centang[i] ? ' ok' : ''}`}>
            <input type="checkbox" checked={centang[i]} onChange={() => setCentang(centang.map((v, k) => (k === i ? !v : v)))} />
            {i + 1}. {j}
          </label>
        ))}
      </div>
      <div className="isian">
        <label htmlFor={id}>{banyak ? `Bait-bait Anda (${jumlah} bait)` : 'Bait Anda (dua syathr, satu per baris)'}</label>
        <textarea id={id} className="ar" dir="rtl" lang="ar" rows={banyak ? Math.min(12, jumlah + 2) : 3} value={teks} onChange={(e) => setTeks(e.target.value)} placeholder={banyak ? 'syathr pertama | syathr kedua' : 'syathr pertama\nsyathr kedua'} />
        <span className="bantu">
          Tulis lengkap dengan harakat.{' '}
          {banyak ? 'Satu bait per baris dengan pemisah |, atau dua baris berurutan untuk satu bait.' : 'Pemisah syathr: baris baru atau tanda |.'}
        </span>
      </div>
      <div className="baris">
        <button type="button" className="tombol utama" onClick={timbang} disabled={!teks.trim()}>Timbang</button>
        {t.bankKata && <button type="button" className="tombol" onClick={() => setBank(!bank)} aria-expanded={bank}>{bank ? 'Tutup laci' : 'Buka laci kata'}</button>}
        {banyak && akhir && <span className={`chip ${akhir.bait.length >= jumlah ? 'ok' : ''}`}>{akhir.bait.length} dari {jumlah} bait</span>}
      </div>
      {bank && <Laci />}
      {galat && <div className="pesan salah">{galat}</div>}
      {versi.length > 0 && (
        <div className="kartu">
          <span className="label">Versi</span>
          <ul className="versi">
            {versi.map((v, i) => (
              <li key={i}>
                <span className="chip">v{i + 1}</span>
                <span className={`chip ${patahTotal(v) === 0 ? 'ok' : 'salah'}`}>patah {patahTotal(v)}</span>
                {banyak && <span className="chip">{v.bait.length} bait</span>}
                {v.qafiyah.length > 0 && <span className="chip salah">qafiyah {v.qafiyah.length}</span>}
                <span className="versi-bait" dir="rtl" lang="ar">{v.bait[0]?.[0]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {akhir && !banyak && (
        <HasilTimbang key={versi.length} hasil={akhir.hasil[0]} bait={akhir.bait[0]} salin judulDiwan={`${judulDiwan} v${versi.length}`} />
      )}
      {akhir && banyak && (
        <div className="tumpuk" key={versi.length}>
          {akhir.qafiyah.length > 0 && (
            <div className="pesan salah">
              <ul className="pesan-daftar">{akhir.qafiyah.map((m, i) => <li key={i}>Bait {m.bait}: {m.pesan}</li>)}</ul>
            </div>
          )}
          <ol className="bait-daftar">
            {akhir.bait.map((b, i) => {
              const h = akhir.hasil[i]
              const q = akhir.qafiyah.some((m) => m.bait === i + 1)
              return (
                <li key={i}>
                  <div className="baris-antara">
                    <div className="baris" style={{ gap: 'var(--s-2)' }}>
                      <span className="chip">Bait {i + 1}</span>
                      <span className={`chip ${h.patah === 0 ? 'ok' : 'salah'}`}>patah {h.patah}</span>
                      {t.qafiyah && <span className={`chip ${q ? 'salah' : 'ok'}`}>{q ? 'ujung lain' : 'qafiyah pas'}</span>}
                    </div>
                    <button type="button" className="tombol kecil" onClick={() => setBuka(buka === i ? null : i)} aria-expanded={buka === i}>
                      {buka === i ? 'Tutup' : 'Lihat timbangan'}
                    </button>
                  </div>
                  <div className="bait-teks" dir="rtl" lang="ar">
                    {b.map((sy, k) => <span key={k}>{sy}</span>)}
                  </div>
                  {buka === i && <HasilTimbang hasil={h} bait={b} />}
                </li>
              )
            })}
          </ol>
          <SalinDiwan judulAwal={`${judulDiwan} v${versi.length}`} buatMd={(judul) => diwanQasidah(judul, akhir.bait, akhir.hasil)} />
        </div>
      )}
    </div>
  )
}
