import { lazy, Suspense } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth'
import { MeProvider, rumahUntuk, useMe } from './me'
import { Galat, Memuat } from './components/ui'
import { NavOrtu } from './components/Nav'
import LayoutPenulis from './components/LayoutPenulis'
import Masuk from './pages/Masuk'
import Beranda from './pages/penulis/Beranda'
import Modul from './pages/penulis/Modul'
import Misi from './pages/penulis/Misi'
import type { Peran } from './types'

// Halaman yang jarang dibuka (editor, Pojok Orang Tua, cetak, tamu) diunduh saat dibutuhkan.
const KartuAlat = lazy(() => import('./pages/penulis/KartuAlat'))
const LatihanHarian = lazy(() => import('./pages/penulis/LatihanHarian'))
const RuangLatihan = lazy(() => import('./pages/penulis/RuangLatihan'))
const Jejak = lazy(() => import('./pages/penulis/Jejak'))
const Tukar = lazy(() => import('./pages/penulis/Tukar'))
const RuangPenulis = lazy(() => import('./pages/penulis/RuangPenulis'))
const NaskahBaru = lazy(() => import('./pages/penulis/NaskahBaru'))
const DrafNol = lazy(() => import('./pages/penulis/DrafNol'))
const HalamanNaskah = lazy(() => import('./pages/penulis/HalamanNaskah'))
const Revisi = lazy(() => import('./pages/penulis/Revisi'))
const Bandingkan = lazy(() => import('./pages/penulis/Bandingkan'))
const BuatSoal = lazy(() => import('./pages/penulis/BuatSoal'))
const AlatBebas = lazy(() => import('./pages/penulis/AlatBebas'))
const RakBuku = lazy(() => import('./pages/RakBuku'))
const Buku = lazy(() => import('./pages/Buku'))
const LembarCetak = lazy(() => import('./pages/cetak/LembarCetak'))
const Dasbor = lazy(() => import('./pages/ortu/Dasbor'))
const DaftarLembar = lazy(() => import('./pages/ortu/DaftarLembar'))
const PemeriksaanLembar = lazy(() => import('./pages/ortu/PemeriksaanLembar'))
const DaftarNaskah = lazy(() => import('./pages/ortu/DaftarNaskah'))
const NaskahPenulis = lazy(() => import('./pages/ortu/NaskahPenulis'))
const StikerStempel = lazy(() => import('./pages/ortu/StikerStempel'))
const HadiahPoin = lazy(() => import('./pages/ortu/HadiahPoin'))
const CetakModul = lazy(() => import('./pages/ortu/CetakModul'))
const PromptAnak = lazy(() => import('./pages/ortu/PromptAnak'))
const PertanyaanAnak = lazy(() => import('./pages/ortu/PertanyaanAnak'))
const KartuPamerAnak = lazy(() => import('./pages/ortu/KartuPamerAnak'))
const SoalAnak = lazy(() => import('./pages/ortu/SoalAnak'))
const KerjakanSoal = lazy(() => import('./pages/ortu/SoalAnak').then((m) => ({ default: m.KerjakanSoal })))
const DaftarUlasan = lazy(() => import('./pages/tamu/DaftarUlasan'))
const Ulasan = lazy(() => import('./pages/tamu/Ulasan'))

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
      <Suspense fallback={<HalamanMemuat />}><Outlet /></Suspense>
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

export function HalamanMemuat() {
  return <main className="page"><div className="layar"><Memuat /></div></main>
}

function Rute() {
  const { me, error } = useMe()
  if (error) return <main className="page"><div className="layar"><Galat pesan={error} /></div></main>
  if (!me) return <main className="page"><div className="layar"><Memuat /></div></main>
  return (
    <Suspense fallback={<HalamanMemuat />}>
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
        <Route path="/alat/:kode/latihan" element={<RuangLatihan />} />
        <Route path="/jejak" element={<Jejak />} />
        <Route path="/tukar" element={<Tukar />} />
        <Route path="/naskah" element={<RuangPenulis />} />
        <Route path="/naskah/baru" element={<NaskahBaru />} />
        <Route path="/naskah/:id" element={<HalamanNaskah />} />
        <Route path="/naskah/:id/draf-nol" element={<DrafNol />} />
        <Route path="/naskah/:id/revisi/:lapis" element={<Revisi />} />
        <Route path="/naskah/:id/bandingkan" element={<Bandingkan />} />
        <Route path="/soal" element={<BuatSoal />} />
        <Route path="/alat-bebas" element={<AlatBebas />} />
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
          <Route path="/ortu/soal" element={<SoalAnak />} />
          <Route path="/ortu/soal/:id" element={<KerjakanSoal />} />
        </Route>
      </Route>
      <Route element={<Butuh peran="tamu" />}>
        <Route path="/ulasan" element={<DaftarUlasan />} />
        <Route path="/ulasan/:id" element={<Ulasan />} />
      </Route>
      <Route path="*" element={<Navigate to={rumahUntuk(me)} replace />} />
    </Routes>
    </Suspense>
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
