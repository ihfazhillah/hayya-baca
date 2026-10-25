import { useId, useMemo, useState } from 'react'
import type { Tamrin } from '@/content/jenis'
import { kitabahBait } from '@/lib/kitabah'
import { cariBahr } from '@/lib/bahr'
import { belumUtuh, timbangBait } from '@/lib/timbang'
import { diwanMarkdown, diwanQasidah, pisahQasidah } from '@/lib/latihan'
import { bedaUjung, periksaDharb, periksaQafiyah, type MasalahQafiyah } from '@/lib/qafiyah'
import type { HasilBait, Huruf } from '@/lib/jenis'
import Teks from './Teks'
import HasilTimbang from './HasilTimbang'
import SalinDiwan from './SalinDiwan'
import Laci from './Laci'
import KotakTafilah from './KotakTafilah'
import { useJilid } from './Jilid'

type TamrinSusun = Extract<Tamrin, { jenis: 'susun' }>

const TASHIH = [
  "Harakat akhir setiap kata sesuai i'rab-nya (fa'il marfu', maf'ul manshub, majrur setelah huruf jarr).",
  'Mudhaf tidak bertanwin dan tidak ber-alif-lam.',
  "Fi'il cocok dengan fa'il-nya (mudzakkar/muannats, mufrad/jama').",
  'Harakat huruf ujung (majra) mengikuti i\'rab, bukan dipaksa demi qafiyah.',
]

export const JALUR = ['Makna', 'Qafiyah', 'Susun', 'Lagukan', "Taqthi'", 'Perbaiki', 'Diwan'] as const

const rapikan = (s: string) => s.trim().replace(/\s+/g, ' ')

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
  const { salim, modul } = useJilid()
  const [periksa, setPeriksa] = useState<boolean[]>(() => TASHIH.map(() => false))
  const [arti, setArti] = useState('')
  const [syarh, setSyarh] = useState('')
  const [teksPeriksa, setTeksPeriksa] = useState(false)
  const bolehSalin = (!t.tashih || periksa.every(Boolean)) && (!t.arti || !!arti.trim()) && (!t.syarh || !!syarh.trim())
  const catatanDiwan = () => [arti.trim() && `- Arti: ${arti.trim()}`, syarh.trim() && `- Syarh: ${syarh.trim()}`].filter(Boolean).map((x) => `${x}\n`).join('')
  const pola = useMemo(() => {
    if (!t.pola) return null
    const k = kitabahBait(t.pola.bait)
    return k.ok ? timbangBait(k.syathr, bahr) : null
  }, [t.pola, bahr])

  const timbang = () => {
    const bait = banyak ? pisahQasidah(teks) : [pisahQasidah(teks).flat()]
    if (t.pola && bait.flat().map(rapikan).join('|') === t.pola.bait.map(rapikan).join('|')) {
      setGalat('Masih sama dengan pola. Ganti minimal satu kata dulu.')
      return
    }
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
    const qafiyah = t.qafiyah ? periksaQafiyah(syathr, t.qafiyah, !salim) : []
    if (banyak && t.qafiyah === 'satu') qafiyah.push(...periksaDharb(hasil))
    const acuan = pola?.syathr.at(-1)?.huruf
    if (acuan)
      syathr.forEach((b, k) =>
        b.forEach((s, i) => {
          const m = bedaUjung(acuan, s, !salim)
          if (m) qafiyah.push({ bait: k + 1, pesan: `Ujung syathr ${i + 1}: ${m}.` })
        }),
      )
    setVersi([...versi, { bait, hasil, qafiyah }])
    setCentang((c) => c.map((v, i) => v || JALUR[i] === "Taqthi'"))
  }
  const akhir = versi.at(-1)
  const patahTotal = (v: Versi) => v.hasil.reduce((a, h) => a + h.patah, 0)
  const belumTotal = (v: Versi) => (salim ? v.hasil.reduce((a, h) => a + belumUtuh(h).length, 0) : 0)
  const judulDiwan = t.judulDiwan ?? (banyak ? `Qasidah ${bahr.nama}` : 'Bait #1')

  return (
    <div className="tumpuk">
      <p><Teks>{t.petunjuk}</Teks></p>
      <p className="redup"><Teks>{t.makna}</Teks></p>
      {t.bantuan && (
        <section className="kartu" aria-label="Bantuan di Boss ini">
          <span className="label">Bantuan di Boss ini</span>
          <div className="baris" style={{ gap: 'var(--s-2)' }}>
            {t.bantuan.diberi.map((b) => <span key={b} className="chip ok">{b}</span>)}
            {t.bantuan.dicabut.map((b) => <span key={b} className="chip salah"><s>{b}</s></span>)}
          </div>
          <span className="bantu">Hijau: masih diberikan. Dicoret: dicabut di sini, kerjakan sendiri.</span>
        </section>
      )}
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
      {t.tangga && (
        <ol className="rancangan">
          {t.tangga.map((r, i) =>
            typeof r === 'string' ? (
              <li key={i}><Teks>{r}</Teks></li>
            ) : (
              <li key={i}>
                <Teks>{r.teks}</Teks>
                <div className="baris" style={{ gap: 'var(--s-2)' }} aria-label={`Calon pengganti ${r.ganti}`}>
                  {r.calon.map((c) => <span key={c} className="chip ar-in" lang="ar">{c}</span>)}
                </div>
                <span className="bantu">Timbang sendiri: mana yang lagunya sama dengan <span className="ar-in" lang="ar">{r.ganti}</span>?</span>
              </li>
            ),
          )}
        </ol>
      )}
      {t.pola && (
        <section className="kartu pola" aria-label="Pola mu'aradhah">
          <span className="label">Pola mu'aradhah</span>
          {t.pola.bait.map((b, i) => (
            <div key={i} className="pola-syathr">
              <p className="ar" dir="rtl" lang="ar">{b}</p>
              {pola?.syathr[i] && <KotakTafilah syathr={pola.syathr[i]} label={`Kotak syathr ${i + 1}`} />}
            </div>
          ))}
          <span className="bantu">{t.pola.sumber}</span>
        </section>
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
        {t.pola && <button type="button" className="tombol" onClick={() => setTeks(t.pola!.bait.join('\n'))}>Mulai dari pola</button>}
        {t.bankKata && <button type="button" className="tombol" onClick={() => setBank(!bank)} aria-expanded={bank}>{bank ? 'Tutup laci' : 'Buka laci kata'}</button>}
        {banyak && akhir && <span className={`chip ${akhir.bait.length >= jumlah ? 'ok' : ''}`}>{akhir.bait.length} dari {jumlah} bait</span>}
      </div>
      {bank && <Laci sampai={modul} bahr={modul === undefined ? undefined : t.bahr} tema={t.tema} hanyaSaya={t.laci === 'saya'} />}
      {galat && <div className="pesan salah">{galat}</div>}
      {t.tashih && versi.length > 0 && (
        <div className="kartu" role="group" aria-label="Tashih i'rab">
          <span className="label">Tashih i'rab sebelum salin ke Diwan</span>
          {TASHIH.map((x, i) => (
            <label key={i} className="baris" style={{ cursor: 'pointer', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
              <input type="checkbox" checked={periksa[i]} onChange={() => setPeriksa(periksa.map((v, k) => (k === i ? !v : v)))} />
              <span>{x}</span>
            </label>
          ))}
          <span className="bantu">Timbangan hanya memeriksa wazan dan qafiyah. Lughah dan i'rab Anda periksa sendiri.</span>
        </div>
      )}
      {versi.length > 0 && (
        <div className="kartu">
          <span className="label">Versi</span>
          <ul className="versi">
            {versi.map((v, i) => (
              <li key={i}>
                <span className="chip">v{i + 1}</span>
                <span className={`chip ${patahTotal(v) === 0 ? 'ok' : 'salah'}`}>patah {patahTotal(v)}</span>
                {salim && patahTotal(v) === 0 && <span className={`chip ${belumTotal(v) === 0 ? 'ok' : 'salah'}`}>{belumTotal(v) === 0 ? 'utuh semua' : `belum utuh ${belumTotal(v)}`}</span>}
                {banyak && <span className="chip">{v.bait.length} bait</span>}
                {v.qafiyah.length > 0 && <span className="chip salah">qafiyah {v.qafiyah.length}</span>}
                <span className="versi-bait" dir="rtl" lang="ar">{v.bait[0]?.[0]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {akhir && !banyak && akhir.qafiyah.length > 0 && (
        <div className="pesan salah">
          <ul className="pesan-daftar">{akhir.qafiyah.map((m, i) => <li key={i}>{m.pesan}</li>)}</ul>
        </div>
      )}
      {akhir && !banyak && (
        <HasilTimbang key={versi.length} hasil={akhir.hasil[0]} bait={akhir.bait[0]} salin={bolehSalin && !t.arti && !t.syarh} judulDiwan={`${judulDiwan} v${versi.length}`} />
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
          {bolehSalin && <SalinDiwan judulAwal={`${judulDiwan} v${versi.length}`} buatMd={(judul) => diwanQasidah(judul, akhir.bait, akhir.hasil) + catatanDiwan()} />}
        </div>
      )}
      {akhir && (t.arti || t.syarh) && (
        <div className="kartu tumpuk-kecil">
          {t.arti && (
            <>
              <label htmlFor={`${id}-arti`}>Arti bait Anda</label>
              <textarea id={`${id}-arti`} rows={2} value={arti} onChange={(e) => setArti(e.target.value)} placeholder="Makna yang Anda maksud, dalam bahasa Indonesia" />
            </>
          )}
          {t.syarh && (
            <>
              <label htmlFor={`${id}-syarh`}>Syarh singkat: i'rab dan makna per syathr</label>
              <textarea id={`${id}-syarh`} rows={4} value={syarh} onChange={(e) => setSyarh(e.target.value)} placeholder="Seperti syarah matan: kedudukan kata penting dan makna tiap syathr" />
            </>
          )}
          <span className="bantu">Bait yang belum bisa Anda syarah belum matang. Ditulis dulu, baru disalin ke Diwan.</span>
        </div>
      )}
      {akhir && !banyak && bolehSalin && (t.arti || t.syarh) && (
        <SalinDiwan judulAwal={`${judulDiwan} v${versi.length}`} buatMd={(judul) => diwanMarkdown(judul, akhir.bait[0], akhir.hasil[0]) + catatanDiwan()} />
      )}
      {akhir && t.periksa && (
        <div className="tumpuk-kecil">
          <button type="button" className="tombol" onClick={() => setTeksPeriksa(!teksPeriksa)} aria-expanded={teksPeriksa}>Salin untuk diperiksa</button>
          {teksPeriksa && (
            <>
              <textarea readOnly rows={10} aria-label="Teks untuk diperiksa" value={teksUntukDiperiksa(akhir, t.makna, arti, syarh)} onFocus={(e) => e.target.select()} />
              <span className="bantu">Kirim ke ustadz atau tempel ke Claude. Wazan sudah ditimbang mesin; yang diminta adalah pemeriksaan i'rab, kata, makna, dan tema.</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/** Fase E: satu teks untuk pembaca luar (ustadz atau Claude): bait, timbangan, maksud penulis, dan apa yang diminta. */
function teksUntukDiperiksa(v: Versi, tema: string, arti: string, syarh: string): string {
  const bahr = v.hasil[0]?.bahr.nama ?? '-'
  return [
    "Mohon periksa bait latihan saya. Wazannya sudah ditimbang mesin. Yang saya minta: i'rab, pilihan kata (apakah lazim dipakai orang Arab), apakah makna yang saya maksud sampai, dan kesesuaian dengan tema.",
    '',
    ...v.bait.flatMap((b, i) => [`Bait ${i + 1}:`, ...b.map((s) => `> ${s}`), `(${bahr}, patah ${v.hasil[i]?.patah ?? '?'}, pola ${v.hasil[i]?.syathr.map((s) => s.potongan.map((p) => p.bit).join(' ')).join(' / ') ?? '-'})`]),
    '',
    `Tema: ${tema}`,
    arti.trim() ? `Arti yang saya maksud: ${arti.trim()}` : '',
    syarh.trim() ? `Syarh saya: ${syarh.trim()}` : '',
  ].filter((x, i, a) => x !== '' || a[i - 1] !== '').join('\n')
}
