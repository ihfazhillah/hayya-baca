import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth'
import { MeProvider, rumahUntuk, useMe } from './me'
import { Galat, Memuat } from './components/ui'
import { NavOrtu } from './components/Nav'
import LayoutPenulis from './components/LayoutPenulis'
import Masuk from './pages/Masuk'
import Beranda from './pages/penulis/Beranda'
import KartuAlat from './pages/penulis/KartuAlat'
import Modul from './pages/penulis/Modul'
import Misi from './pages/penulis/Misi'
import LatihanHarian from './pages/penulis/LatihanHarian'
import Jejak from './pages/penulis/Jejak'
import Tukar from './pages/penulis/Tukar'
import RuangPenulis from './pages/penulis/RuangPenulis'
import NaskahBaru from './pages/penulis/NaskahBaru'
import DrafNol from './pages/penulis/DrafNol'
import HalamanNaskah from './pages/penulis/HalamanNaskah'
import Revisi from './pages/penulis/Revisi'
import Bandingkan from './pages/penulis/Bandingkan'
import RakBuku from './pages/RakBuku'
import Buku from './pages/Buku'
import LembarCetak from './pages/cetak/LembarCetak'
import Dasbor from './pages/ortu/Dasbor'
import DaftarLembar from './pages/ortu/DaftarLembar'
import PemeriksaanLembar from './pages/ortu/PemeriksaanLembar'
import DaftarNaskah from './pages/ortu/DaftarNaskah'
import NaskahPenulis from './pages/ortu/NaskahPenulis'
import StikerStempel from './pages/ortu/StikerStempel'
import HadiahPoin from './pages/ortu/HadiahPoin'
import CetakModul from './pages/ortu/CetakModul'
import PromptAnak from './pages/ortu/PromptAnak'
import PertanyaanAnak from './pages/ortu/PertanyaanAnak'
import KartuPamerAnak from './pages/ortu/KartuPamerAnak'
import DaftarUlasan from './pages/tamu/DaftarUlasan'
import Ulasan from './pages/tamu/Ulasan'
import type { Peran } from './types'

function Butuh({ peran }: { peran: Peran }) {
  const { me } = useMe()
  if (!me) return <Memuat />
  if (!me.peran.includes(peran)) {
    // Orang tua yang baru punya anak untuk diaktifkan tetap boleh ke /ortu.
    if (peran === 'pemeriksa' && me.bisa_diaktifkan.length) return <Outlet />
    return <Navigate to={rumahUntuk(me)} replace />
  }
  return <Outlet />
}

function AreaOrtu() {
  return (
    <div className="area-ortu">
      <NavOrtu />
      <Outlet />
    </div>
  )
}

function TanpaPeran() {
  const { logout } = useAuth()
  return (
    <main className="page"><div className="layar tumpuk">
      <h1 className="page-title">Belum ada akses</h1>
      <p>Akun ini belum menjadi penulis atau pemeriksa di Penerbit Rumah. Minta Ayah mengaktifkannya.</p>
      <button className="btn btn-ghost" onClick={logout}>Keluar</button>
    </div></main>
  )
}

function Rute() {
  const { me, error } = useMe()
  if (error) return <main className="page"><div className="layar"><Galat pesan={error} /></div></main>
  if (!me) return <main className="page"><div className="layar"><Memuat /></div></main>
  return (
    <Routes>
      <Route path="/masuk" element={<Navigate to={rumahUntuk(me)} replace />} />
      <Route path="/tanpa-peran" element={<TanpaPeran />} />
      <Route element={<Butuh peran="penulis" />}>
        <Route element={<LayoutPenulis />}>
        <Route path="/" element={<Beranda />} />
        <Route path="/alat" element={<KartuAlat />} />
        <Route path="/modul/:nomor" element={<Modul />} />
        <Route path="/modul/:nomor/misi/:urutan" element={<Misi />} />
        <Route path="/latihan" element={<LatihanHarian />} />
        <Route path="/jejak" element={<Jejak />} />
        <Route path="/tukar" element={<Tukar />} />
        <Route path="/naskah" element={<RuangPenulis />} />
        <Route path="/naskah/baru" element={<NaskahBaru />} />
        <Route path="/naskah/:id" element={<HalamanNaskah />} />
        <Route path="/naskah/:id/draf-nol" element={<DrafNol />} />
        <Route path="/naskah/:id/revisi/:lapis" element={<Revisi />} />
        <Route path="/naskah/:id/bandingkan" element={<Bandingkan />} />
        </Route>
      </Route>
      <Route path="/rak" element={<RakBuku />} />
      <Route path="/rak/:id" element={<Buku />} />
      <Route path="/cetak/:kode" element={<LembarCetak />} />
      <Route element={<Butuh peran="pemeriksa" />}>
        <Route element={<AreaOrtu />}>
          <Route path="/ortu" element={<Dasbor />} />
          <Route path="/ortu/lembar" element={<DaftarLembar />} />
          <Route path="/ortu/lembar/:id" element={<PemeriksaanLembar />} />
          <Route path="/ortu/naskah" element={<DaftarNaskah />} />
          <Route path="/ortu/naskah/:id" element={<NaskahPenulis />} />
          <Route path="/ortu/stiker" element={<StikerStempel />} />
          <Route path="/ortu/hadiah" element={<HadiahPoin />} />
          <Route path="/ortu/cetak" element={<CetakModul />} />
          <Route path="/ortu/prompt" element={<PromptAnak />} />
          <Route path="/ortu/pertanyaan" element={<PertanyaanAnak />} />
          <Route path="/ortu/kartu-pamer" element={<KartuPamerAnak />} />
        </Route>
      </Route>
      <Route element={<Butuh peran="tamu" />}>
        <Route path="/ulasan" element={<DaftarUlasan />} />
        <Route path="/ulasan/:id" element={<Ulasan />} />
      </Route>
      <Route path="*" element={<Navigate to={rumahUntuk(me)} replace />} />
    </Routes>
  )
}

export default function App() {
  const { token } = useAuth()
  if (!token) {
    return (
      <Routes>
        <Route path="*" element={<Masuk />} />
      </Routes>
    )
  }
  return (
    <MeProvider>
      <Rute />
    </MeProvider>
  )
}
