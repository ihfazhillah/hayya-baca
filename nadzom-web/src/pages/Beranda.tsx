import { Link } from 'react-router-dom'
import { BABAK, MODUL, judulPeta, namaModul } from '@/content'
import { kodePelajaran, sudahSelesai } from '@/lib/progres'
import Teks from '@/components/Teks'

/** Pelajaran pertama yang belum dicentang, untuk tombol "Lanjutkan". */
function pelajaranBerikut(): { modul: number; nama: string; pelajaran: number; mulai: boolean } {
  for (const m of MODUL) {
    for (const p of m.pelajaran) {
      if (!sudahSelesai(kodePelajaran(m.nomor, p.nomor, p.versi))) {
        return { modul: m.nomor, nama: namaModul(m), pelajaran: p.nomor, mulai: m.nomor === 0 && p.nomor === 1 }
      }
    }
  }
  const m = MODUL.at(-1)!
  return { modul: m.nomor, nama: namaModul(m), pelajaran: m.pelajaran.at(-1)!.nomor, mulai: false }
}

export default function Beranda() {
  const tersedia = new Set(MODUL.map((m) => m.nomor))
  const lanjut = pelajaranBerikut()

  return (
    <>
      <section className="judul-halaman">
        <span className="label">Course mandiri · 2–3 jam sepekan</span>
        <h1>Menyusun nadzom dan syair untuk orang 'ajam</h1>
        <p className="lead">
          Telinga kita menghitung suku kata; wazan Arab menghitung huruf hidup dan mati.
          Di sini Anda menimbang bait dengan tanda <span className="bit">1</span> dan <span className="bit">0</span>,
          lalu menyusun bait sendiri, satu sesi satu hasil.
        </p>
        <div className="baris" style={{ marginTop: 'var(--s-2)' }}>
          <Link className="tombol utama" to={`/modul/${lanjut.modul}/${lanjut.pelajaran}`}>
            {lanjut.mulai ? 'Mulai Modul 0' : `Lanjutkan: ${lanjut.nama}, pelajaran ${lanjut.pelajaran}`}
          </Link>
          <Link className="tombol" to="/timbang">Timbang bait</Link>
        </div>
      </section>

      <section className="tumpuk" aria-label="Peta course">
        {BABAK.map((b) => (
          <article className="babak" key={b.nomor}>
            <div className="babak-kepala">
              <span className="segel" aria-hidden="true">{b.nomor === 4 ? '+' : b.nomor}</span>
              <h2>{b.nomor === 4 ? b.judul : `Babak ${b.nomor}: ${b.judul}`}</h2>
              <span className="babak-bahr"><Teks>{b.bahr}</Teks></span>
            </div>
            <p className="babak-ringkas">{b.ringkas}</p>
            <ul className="modul-daftar">
              {b.modul.map((m, i) => {
                const aktif = tersedia.has(m.nomor)
                const isi = (
                  <>
                    <span className="modul-nomor">{m.boss ? 'B' : m.bonus ? '+' : m.nomor}</span>
                    <span className="modul-teks">
                      <span className="modul-judul">{judulPeta(m)}</span>
                      <span className="modul-fokus">{m.fokus} · hasil: {m.hasil}</span>
                    </span>
                    <span className={aktif ? 'chip ok' : 'chip'}>{aktif ? 'Buka' : 'Segera'}</span>
                  </>
                )
                const kelas = `modul-baris${aktif ? ' aktif' : ' segera'}${m.boss ? ' boss' : ''}`
                return (
                  <li key={i}>
                    {aktif ? <Link className={kelas} to={`/modul/${m.nomor}`}>{isi}</Link> : <div className={kelas}>{isi}</div>}
                  </li>
                )
              })}
            </ul>
          </article>
        ))}
      </section>
    </>
  )
}
