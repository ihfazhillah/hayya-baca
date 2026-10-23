import { useState } from 'react'
import type {
  BantuanPerasaan, HasilPerasaan, KunciPerasaan, LangkahContoh, PercobaanPerasaan, SoalPerasaan, Token,
} from '../types'
import ContohOren from './ContohOren'

/** Kamera (spec 075 K1, Fase B): anak membaca apa yang dilakukan tokoh, memilih perasaannya,
 *  lalu mengklik kata yang menjadi buktinya. Penilaian di server per jawaban; kunci satu soal
 *  baru dikirim setelah soal itu selesai. Dengan `contoh`, soal pertama dikerjakan Oren. */
export interface PilihPerasaanProps {
  soal: SoalPerasaan[]
  contoh: LangkahContoh[]
  awal?: PercobaanPerasaan
  /** undefined = misi tanpa bantuan memudar. */
  bantuan?: BantuanPerasaan
  onKirim: (body: { soal: number; perasaan?: string; token?: number }) => Promise<HasilPerasaan>
  onSelesai: (h: HasilPerasaan) => void
}

const PESAN_GAGAL = 'Belum tersambung. Coba lagi, ya.'

export default function PilihPerasaan({ soal, contoh, awal, bantuan: bantuanAwal, onKirim, onSelesai }: PilihPerasaanProps) {
  const mulai = contoh.length > 0 ? 1 : 0
  const jumlah = soal.length - mulai
  const [idx, setIdx] = useState<number | null>(awal ? awal.soal : mulai)
  const [perasaan, setPerasaan] = useState<string | null>(awal?.perasaan ?? null)
  const [salah, setSalah] = useState<Set<string>>(() => new Set())
  const [diklik, setDiklik] = useState<Set<number>>(() => new Set(awal?.diklik ?? []))
  const [ditemukan, setDitemukan] = useState(awal?.ditemukan ?? 0)
  const [goyang, setGoyang] = useState<number | null>(null)
  const [pesan, setPesan] = useState<string | null>(null)
  const [kunci, setKunci] = useState<KunciPerasaan | null>(null)
  const [berikut, setBerikut] = useState<number | null>(null)
  const [selesai, setSelesai] = useState(false)
  const [sibuk, setSibuk] = useState(false)
  const memudar = bantuanAwal !== undefined
  const [bantuan, setBantuan] = useState<BantuanPerasaan>(bantuanAwal ?? null)
  const sudahMulai = !!awal && (awal.soal !== mulai || !!awal.perasaan || awal.diklik.length > 0 || awal.meleset > 0)
  const [lihatContoh, setLihatContoh] = useState(contoh.length > 0 && !sudahMulai)

  const s = idx !== null ? soal[idx] : undefined

  async function kirim(body: { perasaan?: string; token?: number }) {
    if (idx === null || sibuk || kunci) return
    setSibuk(true)
    try {
      const r = await onKirim({ soal: idx, ...body })
      if (r.bantuan !== undefined) setBantuan(r.bantuan)
      if (body.perasaan !== undefined) {
        if (r.hasil === 'benar' || r.hasil === 'sudah') {
          setPerasaan(body.perasaan)
          setPesan(`Benar, dia ${body.perasaan}! Sekarang klik kata yang membuatmu tahu.`)
        } else {
          setSalah((x) => new Set(x).add(body.perasaan!))
          setPesan('Belum tepat. Lihat lagi apa yang dia lakukan.')
        }
      } else if (body.token !== undefined) {
        setDitemukan(r.ditemukan)
        if (r.hasil === 'ketemu') {
          setDiklik((x) => new Set(x).add(body.token!))
          setPesan(r.butir_selesai ? null : `Ketemu! ${r.ditemukan} dari ${r.total} bukti.`)
        } else if (r.hasil === 'sudah') {
          setPesan('Yang ini sudah kamu temukan.')
        } else {
          setGoyang(body.token)
          setTimeout(() => setGoyang(null), 320)
          setPesan('Bukan yang ini. Kata ini tidak menunjukkan perasaannya.')
        }
      }
      if (r.butir_selesai && r.jawaban !== undefined) {
        setKunci({ jawaban: r.jawaban, bukti: r.bukti ?? [], alasan: r.alasan ?? '' })
        setBerikut(r.soal)
      }
      if (r.selesai) {
        setSelesai(true)
        onSelesai(r)
      }
    } catch (e) {
      setPesan(e instanceof Error && e.message ? e.message : PESAN_GAGAL)
    } finally {
      setSibuk(false)
    }
  }

  function lanjut() {
    setIdx(berikut)
    setPerasaan(null)
    setSalah(new Set())
    setDiklik(new Set())
    setDitemukan(0)
    setKunci(null)
    setBerikut(null)
    setPesan(null)
  }

  const contohOren = lihatContoh && soal[0] && (
    <ContohOren tokens={soal[0].tokens} langkah={contoh} pilihan={soal[0].pilihan} onSelesai={() => setLihatContoh(false)} />
  )
  if (lihatContoh) return <div className="tumpuk pilih-perasaan">{contohOren}</div>

  const bantuanIni = bantuan && bantuan.soal === idx && !kunci ? bantuan : null
  const tunjuk = new Set(bantuanIni?.tingkat === 'tunjuk' ? bantuanIni.token : [])
  const letak = bantuanIni?.tingkat === 'letak' ? bantuanIni.kalimat : null
  const buktiTerbuka = new Set(kunci?.bukti.flat() ?? [])
  const kelas = (t: Token) => [
    diklik.has(t.i) || buktiTerbuka.has(t.i) ? 'ditemukan' : '',
    tunjuk.has(t.i) ? 'bantuan-tunjuk' : '',
    letak && t.i >= letak[0] && t.i <= letak[1] ? 'kalimat-petunjuk' : '',
  ].filter(Boolean).join(' ') || undefined
  const bisaKlik = !!perasaan && !kunci && !selesai

  return (
    <div className="tumpuk pilih-perasaan">
      {contoh.length > 0 && (
        <p><button type="button" className="btn btn-ghost" onClick={() => setLihatContoh(true)}>🐱 Lihat contoh Oren lagi</button></p>
      )}
      {s && idx !== null && (
        <>
          <p className="kecil" style={{ fontWeight: 600 }}>Soal {idx - mulai + 1} dari {jumlah}</p>
          <div className="teks-latihan" aria-label="Apa yang dilakukan tokohnya">
            {s.tokens.map((t) => (bisaKlik && t.j === 'kata' ? (
              <button key={t.i} type="button" onClick={() => kirim({ token: t.i })}
                className={['kata', kelas(t), goyang === t.i ? 'meleset' : ''].filter(Boolean).join(' ')}>
                {t.t}
              </button>
            ) : (
              <span key={t.i} className={kelas(t)}>{t.t}</span>
            )))}
          </div>
          <div className="tumpuk" role="group" aria-label="Perasaannya apa?">
            <p style={{ fontWeight: 600, margin: 0 }}>Perasaannya apa?</p>
            <div className="baris">
              {s.pilihan.map((p) => (
                <button key={p} type="button" aria-pressed={perasaan === p}
                  className={`btn-besar sekunder pilihan-perasaan${perasaan === p ? ' aktif' : ''}${salah.has(p) ? ' salah' : ''}`}
                  disabled={!!perasaan || salah.has(p) || sibuk} onClick={() => kirim({ perasaan: p })}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          {perasaan && !kunci && (
            <div className="penghitung" aria-live="polite">{ditemukan} dari {s.jumlah_bukti} bukti ditemukan</div>
          )}
          {memudar && !kunci && !selesai && (
            <div role="note" aria-label="Bantuan Oren" className="bantuan-oren">
              <span aria-hidden="true">🐱</span>
              <p>
                {tunjuk.size > 0 ? 'Lihat kata yang bersinar. Perasaan apa yang terlihat?'
                  : letak ? 'Buktinya ada di kalimat yang kuning.'
                    : 'Sekarang cari sendiri, ya. Kamu pasti bisa!'}
              </p>
            </div>
          )}
          {pesan && <p role="status" className="ph-pesan">{pesan}</p>}
          {kunci && (
            <div className="callout callout-accent" aria-live="polite">
              <div className="callout-content">
                <span className="callout-title">Dia {kunci.jawaban}.</span>
                <p>{kunci.alasan}</p>
              </div>
            </div>
          )}
          {kunci && !selesai && berikut !== null && (
            <p><button type="button" className="btn-besar" onClick={lanjut}>Soal berikutnya</button></p>
          )}
        </>
      )}
    </div>
  )
}
