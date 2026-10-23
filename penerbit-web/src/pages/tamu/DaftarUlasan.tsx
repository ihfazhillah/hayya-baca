import { Link } from 'react-router-dom'
import { listUlasan } from '../../api'
import { Galat, Memuat } from '../../components/ui'
import { useAuth } from '../../auth'
import { tgl, useMuat } from '../ortu/umum'
import '../../styles/ortu-halaman.css'

export default function DaftarUlasan() {
  const { logout } = useAuth()
  const { data, error } = useMuat(listUlasan, [])
  return (
    <main className="page">
      <div className="layar tumpuk">
        <div className="baris" style={{ justifyContent: 'space-between' }}>
          <span className="kecil">Penerbit Rumah · Editor Tamu</span>
          <button type="button" className="btn btn-ghost btn-kecil" onClick={logout}>Keluar</button>
        </div>
        <h1 className="page-title">Ulasan</h1>
        <p className="kecil">Cerita yang dibagikan kepadamu. Baca, lalu isi Kartu Ulasan untuk penulisnya.</p>
        <Galat pesan={error} />
        {!data && !error && <Memuat />}
        {data && data.length === 0 && <p>Belum ada cerita yang dibagikan kepadamu.</p>}
        {data && data.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 'var(--space-3)' }}>
            {data.map((u) => (
              <li key={u.id}>
                <Link to={`/ulasan/${u.id}`} className="kartu" style={{ display: 'block', color: 'inherit' }}>
                  <b>{u.judul}</b>
                  <div className="kecil">oleh {u.penulis} · Versi {u.versi} · dibagikan {tgl(u.tanggal)}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
