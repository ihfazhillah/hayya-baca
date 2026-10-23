import { Link } from 'react-router-dom'
import { getRak } from '../api'
import { Galat, Memuat } from '../components/ui'
import { useMe } from '../me'
import { tgl, TautanPulang, useMuat } from './ortu/umum'
import '../styles/ortu-halaman.css'

export default function RakBuku() {
  const { penulisDipilih } = useMe()
  const { data, error } = useMuat(getRak, [penulisDipilih])
  return (
    <main className="page">
      <div className="layar tumpuk">
        <TautanPulang />
        <header className="page-header" style={{ marginBottom: 0 }}>
          <h1 className="page-title">Rak Buku</h1>
          {data && (
            <p className="page-subtitle">
              Buku karya {data.penulis}{data.buku.length > 0 ? ` · ${data.buku.length} buku` : ''}
            </p>
          )}
        </header>
        <Galat pesan={error} />
        {!data && !error && <Memuat />}
        {data && data.buku.length === 0 && (
          <p>Rak masih kosong. Cerita yang sudah mendapat 5 stempel dan diterbitkan akan muncul di sini.</p>
        )}
        {data && data.buku.length > 0 && (
          <section className="rak" aria-label="Rak">
            <div className="rak-isi">
              {data.buku.map((b) => (
                <Link key={b.id} to={`/rak/${b.id}`} className="buku-rak" aria-label={`${b.judul} ${b.nomor_terbitan}`}>
                  {b.sampul ? (
                    <img className="sampul" src={b.sampul} alt="" />
                  ) : (
                    <span className="sampul sampul-teks">
                      <span className="mono">{b.nomor_terbitan}</span>
                      <b>{b.judul}</b>
                      <span>{data.penulis}</span>
                    </span>
                  )}
                  <span className="judul-rak">{b.judul}</span>
                  <span className="nomor-terbitan">{b.nomor_terbitan}{b.tanggal_terbit ? ` · ${tgl(b.tanggal_terbit)}` : ''}</span>
                </Link>
              ))}
              <span className="buku-rak buku-berikutnya" aria-hidden="true">
                <span className="sampul">Buku berikutnya</span>
                <span className="judul-rak">&nbsp;</span>
                <span className="nomor-terbitan">&nbsp;</span>
              </span>
            </div>
            <div className="papan-rak" aria-hidden="true" />
          </section>
        )}
      </div>
    </main>
  )
}
