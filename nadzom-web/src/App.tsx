import { useEffect } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { WajahHudhud } from './components/Hudhud'
import Beranda from './pages/Beranda'
import ModulPage from './pages/ModulPage'
import PelajaranPage from './pages/PelajaranPage'
import Checker from './pages/Checker'
import Rujukan from './pages/Rujukan'

function GulirKeAtas() {
  const { pathname } = useLocation()
  useEffect(() => window.scrollTo(0, 0), [pathname])
  return null
}

export default function App() {
  return (
    <>
      <GulirKeAtas />
      <header className="kepala">
        <div className="kepala-isi">
          <Link to="/" className="merek" aria-label="Nadzom, beranda">
            <WajahHudhud />
            <span className="merek-nama">Nadzom</span>
          </Link>
          <nav className="navigasi" aria-label="Utama">
            <NavLink to="/" end className={({ isActive }) => (isActive ? 'aktif' : '')}>Peta</NavLink>
            <NavLink to="/timbang" className={({ isActive }) => (isActive ? 'aktif' : '')}>Timbang</NavLink>
            <NavLink to="/rujukan" className={({ isActive }) => (isActive ? 'aktif' : '')}>Rujukan</NavLink>
          </nav>
        </div>
      </header>
      <main className="halaman">
        <Routes>
          <Route path="/" element={<Beranda />} />
          <Route path="/modul/:modul" element={<ModulPage />} />
          <Route path="/modul/:modul/:pelajaran" element={<PelajaranPage />} />
          <Route path="/timbang" element={<Checker />} />
          <Route path="/rujukan" element={<Rujukan />} />
          <Route path="*" element={<div className="tumpuk"><h1>Halaman tidak ditemukan</h1><Link to="/">Kembali ke peta</Link></div>} />
        </Routes>
      </main>
    </>
  )
}
