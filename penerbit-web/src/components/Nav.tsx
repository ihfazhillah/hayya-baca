import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ulangSimulasi } from '../api'
import { useAuth } from '../auth'
import { useMe } from '../me'
import { TitikModul } from './NavModul'

/** Nav area Penulis: judul course, titik modul, nama penulis + poin. */
export function NavPenulis({ titik = [], poin }: {
  titik?: { nomor: number; judul: string; status: 'selesai' | 'aktif' | 'terbuka' | 'terkunci' }[]
  poin?: number
}) {
  const { me } = useMe()
  const { logout } = useAuth()
  const cocok = useLocation().pathname.match(/^\/modul\/(\d+)/)
  const nomorModul = cocok ? Number(cocok[1]) : undefined
  return (
    <>
    {me?.sedang_simulasi && <BannerSimulasi />}
    <nav className={`nav nav-penulis tidak-dicetak${me?.sedang_simulasi ? ' nav-simulasi' : ''}`}>
      <div className="nav-inner">
        <div className="nav-title">
          <span className="nav-course-label">Penerbit Rumah</span>
          <Link to="/">Beranda</Link>
        </div>
        <div className="nav-links">
          <NavLink to="/naskah">Ruang Penulis</NavLink>
          <span>{me?.penulis?.nama}{poin !== undefined ? ` · ${poin} poin` : ''}</span>
          {!me?.sedang_simulasi && <button className="btn btn-ghost" onClick={logout}>Keluar</button>}
        </div>
      </div>
      <div className="nav-baris-modul">
        <TitikModul peta={titik} nomor={nomorModul} />
      </div>
    </nav>
    </>
  )
}

/** Pita di atas nav saat orang tua sedang "Lihat sebagai anak". */
function BannerSimulasi() {
  const { gantiSimulasi } = useMe()
  const navigate = useNavigate()
  async function keluar() {
    await gantiSimulasi(false)
    navigate('/ortu')
  }
  async function ulang() {
    await ulangSimulasi()
    await gantiSimulasi(true)
    navigate('/')
  }
  return (
    <div className="banner-simulasi tidak-dicetak" role="status">
      <span className="banner-teks">Mode simulasi<span className="banner-rinci">: progres di sini terpisah dari anak. Semua modul terbuka.</span></span>
      <button type="button" className="btn btn-ghost" onClick={ulang}>Mulai ulang simulasi</button>
      <button type="button" className="btn btn-ghost" onClick={keluar}>Kembali ke Pojok Orang Tua</button>
    </div>
  )
}

/** Nav area Pemeriksa: baris atas judul + akun (pilihan penulis, simulasi, keluar), baris bawah tautan halaman. */
export function NavOrtu() {
  const { me, penulisDipilih, pilihPenulis, gantiSimulasi } = useMe()
  const { logout } = useAuth()
  const navigate = useNavigate()
  async function lihatSebagaiAnak() {
    await gantiSimulasi(true)
    navigate('/')
  }
  const penulis = me?.pemeriksa ?? []
  return (
    <nav className="nav nav-ortu tidak-dicetak">
      <div className="nav-inner">
        <div className="nav-title">
          <span className="nav-course-label">Penerbit Rumah</span>
          <Link to="/ortu">Pojok Orang Tua</Link>
        </div>
        <div className="nav-links">
          {penulis.length > 1 && (
            <select
              aria-label="Pilih penulis"
              value={penulisDipilih ?? ''}
              onChange={(e) => pilihPenulis(Number(e.target.value))}
            >
              {penulis.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}
            </select>
          )}
          {me?.bisa_simulasi && (
            <button type="button" className="btn btn-ghost" onClick={lihatSebagaiAnak}>Lihat sebagai anak</button>
          )}
          <button className="btn btn-ghost" onClick={logout}>Keluar</button>
        </div>
      </div>
      <div className="nav-baris-ortu nav-links">
        <NavLink to="/ortu/lembar">Pemeriksaan</NavLink>
        <NavLink to="/ortu/pertanyaan">Pertanyaan</NavLink>
        <NavLink to="/ortu/kartu-pamer">Kartu Pamer</NavLink>
        <NavLink to="/ortu/soal">Soal Anak</NavLink>
        <NavLink to="/ortu/naskah">Naskah</NavLink>
        <NavLink to="/ortu/stiker">Stiker</NavLink>
        <NavLink to="/ortu/prompt">Prompt</NavLink>
        <NavLink to="/ortu/hadiah">Hadiah</NavLink>
        <NavLink to="/ortu/cetak">Cetak</NavLink>
      </div>
    </nav>
  )
}
