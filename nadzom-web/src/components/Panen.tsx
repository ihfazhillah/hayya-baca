import { useId, useMemo, useState } from 'react'
import type { Tamrin } from '@/content/jenis'
import { kitabahBait } from '@/lib/kitabah'
import { cariBahr } from '@/lib/bahr'
import { timbangBait } from '@/lib/timbang'
import { simpanKata } from '@/lib/laciSaya'
import Teks from './Teks'
import KotakTafilah from './KotakTafilah'
import { useJilid } from './Jilid'

type TamrinPanen = Extract<Tamrin, { jenis: 'panen' }>

const polaKata = (teks: string) => {
  const k = kitabahBait([teks], { tanpaAkhir: true })
  return k.ok ? k.syathr[0].map((h) => h.bit).join('') : ''
}

/**
 * Panen laci (spec 077): pilih kata berurutan dari bait, lihat polanya, simpan yang pas satu taf'ilah utuh ke Laci saya.
 * Keterampilannya: mengenali potongan yang bisa dipakai ulang dari bait yang dibaca atau didengar.
 */
export default function Panen({ t }: { t: TamrinPanen }) {
  const id = useId()
  const bahr = cariBahr(t.bahr)!
  const hasil = useMemo(() => {
    const k = kitabahBait(t.bait)
    return k.ok ? timbangBait(k.syathr, bahr) : null
  }, [t.bait, bahr])
  const { salim } = useJilid()
  /** Jilid 1: hanya taf'ilah utuh. Sesudahnya, bentuk hasyw yang berubah pun boleh dipanen, dengan nama zihafnya. */
  const utuh = useMemo(
    () =>
      new Map(
        bahr.slot.flat(2)
          .filter((b) => !b.zihaf || (!salim && !b.illah && b.nilai !== 'qabih'))
          .map((b) => [b.bit, b.zihaf ? `${b.nama} (${b.zihaf})` : `${b.nama} utuh`] as const),
      ),
    [bahr, salim],
  )
  const kata = t.bait.map((s) => s.split(/\s+/))
  const [pilih, setPilih] = useState<{ s: number; i: number }[]>([])
  const [arti, setArti] = useState('')
  const [panen, setPanen] = useState<string[]>([])
  const [jumlahLaci, setJumlahLaci] = useState(0)

  const urut = [...pilih].sort((a, b) => a.i - b.i)
  const berurutan = urut.length > 0 && urut.every((p, k) => p.s === urut[0].s && (k === 0 || p.i === urut[k - 1].i + 1))
  const teks = berurutan ? urut.map((p) => kata[p.s][p.i]).join(' ') : ''
  const pola = teks ? polaKata(teks) : ''
  const nama = utuh.get(pola)

  const ketuk = (s: number, i: number) =>
    setPilih(pilih.some((p) => p.s === s && p.i === i) ? pilih.filter((p) => !(p.s === s && p.i === i)) : [...pilih, { s, i }])
  const simpan = () => {
    if (!nama || !arti.trim()) return
    setJumlahLaci(simpanKata({ teks, arti: arti.trim(), pola, cocok: `satu ${nama}`, sumber: [t.sumber] }))
    if (!panen.includes(teks)) setPanen([...panen, teks])
    setPilih([])
    setArti('')
  }

  return (
    <div className="tumpuk">
      <p><Teks>{t.petunjuk}</Teks></p>
      {t.kotak && hasil && (
        <section className="kartu pola" aria-label="Kotak taf'ilah">
          <span className="label">Kotak taf'ilah</span>
          {hasil.syathr.map((s, i) => <KotakTafilah key={i} syathr={s} label={`Kotak syathr ${i + 1}`} />)}
        </section>
      )}
      <div className="tumpuk-kecil" role="group" aria-label="Kata dalam bait">
        {kata.map((baris, s) => (
          <div key={s} className="baris panen-baris" dir="rtl">
            {baris.map((w, i) => {
              const aktif = pilih.some((p) => p.s === s && p.i === i)
              return (
                <button key={i} type="button" lang="ar" className={`tombol panen-kata${aktif ? ' utama' : ''}`} aria-pressed={aktif} onClick={() => ketuk(s, i)}>
                  {w}
                </button>
              )
            })}
          </div>
        ))}
      </div>
      {pilih.length > 0 && !berurutan && <div className="pesan info">Pilih kata yang berurutan dalam satu syathr.</div>}
      {teks && (
        <div className={`pesan ${nama ? 'ok' : 'info'}`}>
          <span className="ar-in" lang="ar">{teks}</span> = <span dir="ltr">{`${pola} · ${nama ? `satu ${nama}` : "belum satu taf'ilah"}`}</span>
        </div>
      )}
      <div className="baris" style={{ alignItems: 'flex-end' }}>
        <div className="isian" style={{ flex: '1 1 220px' }}>
          <label htmlFor={id}>Arti</label>
          <input id={id} type="text" value={arti} onChange={(e) => setArti(e.target.value)} placeholder="arti potongan ini" />
        </div>
        <button type="button" className="tombol utama" onClick={simpan} disabled={!nama || !arti.trim()}>Simpan ke Laci saya</button>
      </div>
      <div className="baris">
        <span className={`chip ${panen.length >= t.jumlah ? 'ok' : ''}`}>{panen.length} dari {t.jumlah} panen</span>
        {panen.map((p) => <span key={p} className="chip ar-in" lang="ar">{p}</span>)}
      </div>
      {jumlahLaci > 0 && jumlahLaci % 10 === 0 && (
        <div className="pesan info">Laci saya sudah {jumlahLaci} kata. Ekspor ke Markdown dan simpan di catatan Anda, karena data browser bisa hilang.</div>
      )}
      <p className="redup kecil"><Teks>{t.sumber}</Teks></p>
    </div>
  )
}
