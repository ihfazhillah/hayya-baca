import { Link, useParams } from 'react-router-dom'
import { cariModul } from '@/content'
import { kodePelajaran, sudahSelesai } from '@/lib/progres'
import Teks from '@/components/Teks'

export default function ModulPage() {
  const nomor = Number(useParams().modul)
  const modul = cariModul(nomor)
  if (!modul) return <div className="tumpuk"><h1>Modul belum tersedia</h1><Link to="/">Kembali ke peta</Link></div>

  return (
    <>
      <section className="judul-halaman">
        <span className="label"><Link to="/">Peta</Link> · Modul {modul.nomor}</span>
        <h1>{modul.judul}</h1>
        <p className="lead"><Teks>{modul.tujuan}</Teks></p>
      </section>
      <section className="babak" aria-label="Daftar pelajaran">
        {modul.pelajaran.map((p) => {
          const selesai = sudahSelesai(kodePelajaran(modul.nomor, p.nomor))
          return (
            <Link key={p.nomor} className="pelajaran-baris" to={`/modul/${modul.nomor}/${p.nomor}`}>
              <span className={`centang${selesai ? ' ya' : ''}`} aria-label={selesai ? 'selesai' : 'belum'}>
                {selesai ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5L20 7" /></svg> : null}
              </span>
              <span className="modul-teks">
                <span className="modul-judul">Pelajaran {p.nomor}: {p.judul}</span>
                <span className="modul-fokus"><Teks>{p.ringkas}</Teks></span>
              </span>
              <span className="chip">{p.menit} menit</span>
            </Link>
          )
        })}
      </section>
    </>
  )
}
