import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../auth'
import { useMe } from '../me'

/** Nav area Penulis: judul course, titik modul, nama penulis + poin. */
export function NavPenulis({ titik = [], poin }: {
  titik?: { nomor: number; judul: string; status: 'selesai' | 'aktif' | 'terkunci' }[]
  poin?: number
}) {
  const { me } = useMe()
  return (
    <nav className="nav tidak-dicetak">
      <div className="nav-inner">
        <div className="nav-title">
          <span className="nav-course-label">Penerbit Rumah</span>
          <Link to="/">Beranda</Link>
        </div>
        <div className="nav-dots" aria-label="Modul">
          {titik.map((t) => (
            <Link
              key={t.nomor}
              to={`/modul/${t.nomor}`}
              title={`Modul ${t.nomor} — ${t.judul}`}
              className={`nav-dot${t.status === 'aktif' ? ' active' : ''}`}
              style={t.status === 'selesai' ? { background: 'var(--color-success)' } : undefined}
            />
          ))}
        </div>
        <div className="nav-links">
          <NavLink to="/naskah">Ruang Penulis</NavLink>
          <span>{me?.penulis?.nama}{poin !== undefined ? ` · ${poin} poin` : ''}</span>
        </div>
      </div>
    </nav>
  )
}

/** Nav area Pemeriksa: Pojok Orang Tua + pilihan penulis bila lebih dari satu. */
export function NavOrtu() {
  const { me, penulisDipilih, pilihPenulis } = useMe()
  const { logout } = useAuth()
  const penulis = me?.pemeriksa ?? []
  return (
    <nav className="nav tidak-dicetak">
      <div className="nav-inner">
        <div className="nav-title">
          <span className="nav-course-label">Penerbit Rumah</span>
          <Link to="/ortu">Pojok Orang Tua</Link>
        </div>
        <div className="nav-links">
          <NavLink to="/ortu/lembar">Pemeriksaan</NavLink>
          <NavLink to="/ortu/naskah">Naskah</NavLink>
          <NavLink to="/ortu/hadiah">Hadiah</NavLink>
          <NavLink to="/ortu/cetak">Cetak</NavLink>
          {penulis.length > 1 && (
            <select
              aria-label="Pilih penulis"
              value={penulisDipilih ?? ''}
              onChange={(e) => pilihPenulis(Number(e.target.value))}
            >
              {penulis.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}
            </select>
          )}
          <button className="btn btn-ghost" onClick={logout}>Keluar</button>
        </div>
      </div>
    </nav>
  )
}
