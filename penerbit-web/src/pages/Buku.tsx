import { Link, useParams } from 'react-router-dom'
import { getBuku } from '../api'
import { Galat, Memuat } from '../components/ui'
import { useMe } from '../me'
import type { Buku as DataBuku } from '../types'
import { paragraf, tgl, useMuat } from './ortu/umum'
import '../styles/ortu-halaman.css'

/** Versi cetak A5 (lihat @page buku di ortu-halaman.css): sampul, isi, Tentang Penulis. */
function BukuCetak({ b }: { b: DataBuku }) {
  const fav = b.paragraf_favorit ?? {}
  return (
    <div className="hanya-cetak buku-cetak" aria-hidden="true">
      <section className="halaman sampul-cetak">
        {b.sampul && <img src={b.sampul} alt="" />}
        <h1>{b.judul}</h1>
        <p>{b.penulis}</p>
        <p style={{ fontSize: '9pt' }}>Penerbit Rumah · {b.nomor_terbitan}</p>
      </section>
      <section className="halaman">
        {paragraf(b.teks ?? '').map((p, i) => <p key={i}>{p}</p>)}
      </section>
      {(b.tentang_penulis || fav.sebelum || fav.sesudah) && (
        <section className="halaman">
          {b.tentang_penulis && (
            <>
              <h2>Tentang Penulis</h2>
              <p>{b.tentang_penulis}</p>
            </>
          )}
          {(fav.sebelum || fav.sesudah) && (
            <>
              <h2>Paragraf favorit</h2>
              {fav.sebelum && <p><b>Sebelum:</b> {fav.sebelum}</p>}
              {fav.sesudah && <p><b>Sesudah:</b> {fav.sesudah}</p>}
            </>
          )}
        </section>
      )}
    </div>
  )
}

export default function Buku() {
  const id = Number(useParams().id)
  const { penulisDipilih } = useMe()
  const { data: b, error } = useMuat(() => getBuku(id), [id, penulisDipilih])
  const fav = b?.paragraf_favorit ?? {}
  return (
    <main className="page">
      <div className="layar tumpuk tidak-dicetak">
        <Link className="kembali" to="/rak">← Rak Buku</Link>
        <Galat pesan={error} />
        {!b && !error && <Memuat />}
        {b && (
          <>
            <header className="kepala-buku">
              {b.sampul ? <img className="sampul" src={b.sampul} alt={`Sampul ${b.judul}`} />
                : <div className="sampul sampul-teks"><b>{b.judul}</b><span>{b.penulis}</span></div>}
              <div className="tumpuk-kecil">
                <span className="nomor-terbitan">
                  {b.nomor_terbitan}{b.tanggal_terbit ? ` · terbit ${tgl(b.tanggal_terbit)}` : ''}
                </span>
                <h1 className="page-title">{b.judul}</h1>
                <p className="kecil">oleh {b.penulis}</p>
                <div>
                  <button type="button" className="btn btn-primary" onClick={() => window.print()}>🖨️ Cetak buku (A5)</button>
                </div>
                <p className="kecil">Untuk dua halaman per kertas A4, pilih “2 halaman per lembar” di dialog cetak.</p>
              </div>
            </header>
            <article className="teks-baca" aria-label="Isi buku">
              {paragraf(b.teks ?? '').map((p, i) => <p key={i}>{p}</p>)}
            </article>
            {(b.tentang_penulis || fav.sebelum || fav.sesudah) && (
              <div className="favorit-dua">
                {b.tentang_penulis && (
                  <section className="kartu-lembut">
                    <h2 className="judul-bagian">Tentang Penulis</h2>
                    <p>{b.tentang_penulis}</p>
                  </section>
                )}
                {(fav.sebelum || fav.sesudah) && (
                  <section className="kartu-lembut">
                    <h2 className="judul-bagian">Paragraf favorit: Sebelum dan Sesudah</h2>
                    {fav.sebelum && <p className="sebelum"><del>{fav.sebelum}</del></p>}
                    {fav.sesudah && <p>{fav.sesudah}</p>}
                  </section>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {b && <BukuCetak b={b} />}
    </main>
  )
}
