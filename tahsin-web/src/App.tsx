import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth'
import { MeProvider, useMe } from './me'
import { NavBar } from './components/NavBar'
import { Spinner } from './components/ui'
import { Login } from './pages/Login'
import { Home } from './pages/Home'
import { BulkEntry } from './pages/BulkEntry'
import { SantriHistory } from './pages/SantriHistory'
import { RecordForm } from './pages/RecordForm'
import { Dashboard } from './pages/Dashboard'
import { SantriDetail } from './pages/SantriDetail'
import { Manage } from './pages/Manage'
import { PengampuSheet } from './pages/PengampuSheet'
import { PrintForm } from './pages/PrintForm'
import { PrintQR } from './pages/PrintQR'

function Shell() {
  const { me, loading, error, refresh } = useMe()
  const location = useLocation()
  const isPrint =
    location.pathname.startsWith('/cetak') ||
    location.pathname.startsWith('/print')

  if (loading) return <Spinner />
  if (error || !me)
    return (
      <div className="p-8 text-center">
        <p className="text-gray-600 mb-4">{error ?? 'Gagal memuat'}</p>
        <button className="text-teal-700 font-semibold" onClick={() => void refresh()}>
          Coba lagi
        </button>
      </div>
    )

  const guardian = me.role === 'guardian'
  return (
    <div className={isPrint ? '' : 'pb-24 max-w-md mx-auto'}>
      <Routes>
        {guardian ? (
          <>
            <Route path="/" element={<Dashboard />} />
            <Route path="/kelola" element={<Manage />} />
            <Route path="/kelola/pengampu/:id" element={<PengampuSheet />} />
            <Route path="/cetak" element={<PrintForm />} />
            <Route path="/cetak/qr/:id" element={<PrintQR />} />
            <Route path="/santri/:id" element={<SantriDetail />} />
            <Route path="/santri/:id/tambah" element={<RecordForm />} />
            <Route path="/rekam/:id/edit" element={<RecordForm />} />
          </>
        ) : (
          <>
            <Route path="/" element={<Home />} />
            <Route path="/input" element={<BulkEntry />} />
            <Route path="/santri/:id" element={<SantriHistory />} />
            <Route path="/santri/:id/tambah" element={<RecordForm />} />
            <Route path="/rekam/:id/edit" element={<RecordForm />} />
          </>
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!isPrint && <NavBar role={me.role} />}
    </div>
  )
}

export default function App() {
  const { token } = useAuth()
  const location = useLocation()

  // Allow the login screen to auto-redeem a ?code= even before auth.
  if (!token) {
    if (location.pathname !== '/login')
      return <Navigate to={`/login${location.search}`} replace />
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <MeProvider>
      <Routes>
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Shell />} />
      </Routes>
    </MeProvider>
  )
}
