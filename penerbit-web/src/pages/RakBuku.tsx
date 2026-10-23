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
          {data && <p className="page-subtitle">Buku karya {data.penulis}</p>}
        </header>
        <Galat pesan={error} />
        {!data && !error && <Memuat />}
        {data && data.buku.length === 0 && (
          <p>Rak masih kosong. Cerita yang sudah mendapat 5 stempel dan diterbitkan akan muncul di sini.</p>
        )}
        {data && data.buku.length > 0 && (
          <div className="rak">
            {data.buku.map((b) => (
              <Link key={b.id} to={`/rak/${b.id}`} aria-label={`${b.judul} ${b.nomor_terbitan}`}>
                {b.sampul ? <img className="sampul" src={b.sampul} alt={`Sampul ${b.judul}`} /> : <div className="sampul">{b.judul}</div>}
                <b>{b.judul}</b>
                <span className="nomor-terbitan">{b.nomor_terbitan}{b.tanggal_terbit ? ` · ${tgl(b.tanggal_terbit)}` : ''}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
