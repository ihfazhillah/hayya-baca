/** Satu lembar kerja A4 siap cetak (tinta hitam, huruf isi ≥14pt, kotak orang tua di bawah).
 *  Dipakai /cetak/<kode> dan Cetak per modul. */
import type { Lembar } from '../types'

function Garis({ n }: { n: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => <div key={i} className="garis" aria-hidden="true" />)}
    </>
  )
}

const HANYA_GARIS = /^\s*_{3,}\s*$/
const AKHIR_GARIS = /\s*_{4,}\s*$/

/** Satu baris soal. Garis bawah "____" di teks dijadikan ruang tulis selebar sisa baris,
 *  supaya anak punya tempat cukup untuk satu kalimat (bukan hanya 20 garis bawah). */
function BarisSoal({ teks, tanpaIsian = false }: { teks: string; tanpaIsian?: boolean }) {
  if (HANYA_GARIS.test(teks)) return <div className="garis" aria-hidden="true" />
  if (AKHIR_GARIS.test(teks)) {
    const awal = teks.replace(AKHIR_GARIS, '')
    if (tanpaIsian) return <p className="soal">{awal}</p>
    const isian = (
      <p className="soal soal-isian">
        <span>{awal}</span>
        <span className="isian-garis" aria-hidden="true" />
      </p>
    )
    // Isian bernomor ("1. Bagian favoritku: ____") butuh satu kalimat penuh: beri satu garis lagi.
    if (/^\s*\d+\.\s/.test(teks)) return <>{isian}<div className="garis" aria-hidden="true" /></>
    return isian
  }
  return <p className="soal">{teks}</p>
}

/** Soal dibaca per baris; baris kosong menjadi jarak kecil. */
function Soal({ soal }: { soal: string }) {
  return (
    <>
      {soal.split('\n').map((b, i) =>
        b.trim() ? <BarisSoal key={i} teks={b} /> : <div key={i} className="jarak-soal" aria-hidden="true" />,
      )}
    </>
  )
}

/** Soal berbaris banyak: ruang menulis dibagi rata di bawah setiap baris soal. */
export function SoalDanRuang({ soal, baris }: { soal: string; baris: number }) {
  const barisSoal = soal.split('\n').filter((b) => b.trim())
  if (barisSoal.length > 1 && baris >= barisSoal.length) {
    const per = Math.floor(baris / barisSoal.length)
    const sisa = baris - per * barisSoal.length
    return (
      <div className="soal-ruang">
        {barisSoal.map((b, i) => (
          <div key={i} className="soal-blok">
            <BarisSoal teks={b} tanpaIsian />
            <Garis n={per + (i === barisSoal.length - 1 ? sisa : 0)} />
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="soal-ruang">
      {soal.trim() && <Soal soal={soal} />}
      <Garis n={baris} />
    </div>
  )
}

export default function LembarA4({ lembar }: { lembar: Lembar }) {
  return (
    <article className="lembar-cetak lembar-a4" aria-label={`Lembar ${lembar.kode}`}>
      <header className="kepala">
        <div>
          <div className="modul-lembar">
            <span className="logo">Penerbit Rumah</span> · Modul {lembar.modul.nomor} · {lembar.modul.judul}
          </div>
          <h1>{lembar.judul}</h1>
        </div>
        <div className="kode-pojok">{lembar.kode}</div>
      </header>
      <div className="nama-tanggal">
        <span>Nama: ______________________</span>
        <span>Tanggal: ______________</span>
      </div>
      {lembar.petunjuk && <p className="petunjuk">{lembar.petunjuk}</p>}
      <SoalDanRuang soal={lembar.soal} baris={lembar.baris_tulis} />
      {lembar.pertanyaan_bantu && (
        <p className="bantu"><b>Pertanyaan bantu:</b> {lembar.pertanyaan_bantu}</p>
      )}
      {lembar.cek_sendiri.length > 0 && (
        <div className="cek-sendiri">
          <b>Periksa sendiri</b>
          <ul className="cek">
            {lembar.cek_sendiri.map((c, i) => <li key={i}>☐ {c}</li>)}
          </ul>
        </div>
      )}
      <section className="kotak-ortu" aria-label="Untuk Ayah atau Ummah">
        <b>Untuk Ayah atau Ummah</b>
        {lembar.kriteria && <p>{lembar.kriteria}</p>}
        {lembar.contoh_jawaban && <p className="contoh"><b>Contoh:</b> {lembar.contoh_jawaban}</p>}
        {lembar.saran_stiker && <p><i>{lembar.saran_stiker}</i></p>}
        <div className="pilihan-ortu">
          <span>☐ Sudah bagus</span>
          <span>☐ Coba lagi</span>
          <span>Stiker: ☐ Perunggu ☐ Perak ☐ Emas</span>
          <span>Paraf: <span className="kotak-paraf" /></span>
        </div>
      </section>
    </article>
  )
}
