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

/** Soal berbaris banyak: ruang menulis dibagi rata di bawah setiap baris soal. */
function SoalDanRuang({ soal, baris }: { soal: string; baris: number }) {
  const barisSoal = soal.split('\n').filter((b) => b.trim())
  if (barisSoal.length > 1 && baris >= barisSoal.length) {
    const per = Math.floor(baris / barisSoal.length)
    const sisa = baris - per * barisSoal.length
    return (
      <div className="soal-ruang">
        {barisSoal.map((b, i) => (
          <div key={i}>
            <p className="soal">{b}</p>
            <Garis n={per + (i === barisSoal.length - 1 ? sisa : 0)} />
          </div>
        ))}
      </div>
    )
  }
  return (
    <div className="soal-ruang">
      {soal.trim() && <p className="soal">{soal}</p>}
      <Garis n={baris} />
    </div>
  )
}

export default function LembarA4({ lembar }: { lembar: Lembar }) {
  return (
    <article className="lembar-cetak lembar-a4" aria-label={`Lembar ${lembar.kode}`}>
      <header className="kepala">
        <div>
          <div className="logo">Penerbit Rumah</div>
          <div style={{ fontSize: '12pt', lineHeight: 1.4 }}>
            Modul {lembar.modul.nomor} · {lembar.modul.judul}
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
        <p><b>Pertanyaan bantu:</b> {lembar.pertanyaan_bantu}</p>
      )}
      {lembar.cek_sendiri.length > 0 && (
        <div>
          <b>Periksa sendiri</b>
          <ul className="cek">
            {lembar.cek_sendiri.map((c, i) => <li key={i}>☐ {c}</li>)}
          </ul>
        </div>
      )}
      <section className="kotak-ortu" aria-label="Untuk Ayah atau Ummah">
        <b>Untuk Ayah atau Ummah</b>
        {lembar.kriteria && <p>{lembar.kriteria}</p>}
        {lembar.contoh_jawaban && <p><b>Contoh:</b> {lembar.contoh_jawaban}</p>}
        {lembar.saran_stiker && <p><i>{lembar.saran_stiker}</i></p>}
        <p style={{ marginTop: 8 }}>
          ☐ Sudah bagus &nbsp; ☐ Coba lagi &nbsp;&nbsp; Stiker: ☐ Perunggu ☐ Perak ☐ Emas &nbsp;&nbsp;
          Paraf: <span className="kotak-paraf" />
        </p>
      </section>
    </article>
  )
}
