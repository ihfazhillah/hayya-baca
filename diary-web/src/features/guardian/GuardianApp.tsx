import { NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { useSession } from '@/auth/SessionProvider'
import Feed from './Feed'
import GuardianPostDetail from './GuardianPostDetail'
import Admin from './Admin'
import TelegramSettings from './TelegramSettings'

function TopNav() {
  const { switchProfile } = useSession()
  const navigate = useNavigate()
  const link = ({ isActive }: { isActive: boolean }) =>
    'rounded-full px-3 py-1 text-sm font-medium ' +
    (isActive ? 'bg-purple-600 text-white' : 'text-purple-600')
  return (
    <header className="mx-auto mb-5 flex max-w-xl items-center justify-between">
      <nav className="flex gap-1">
        <NavLink to="/" end className={link}>
          Beranda
        </NavLink>
        <NavLink to="/kelola" className={link}>
          Kelola Anak
        </NavLink>
        <NavLink to="/telegram" className={link}>
          Telegram
        </NavLink>
      </nav>
      <button
        onClick={() => {
          switchProfile()
          navigate('/')
        }}
        className="text-sm text-purple-400 underline"
      >
        Ganti profil
      </button>
    </header>
  )
}

export default function GuardianApp() {
  return (
    <div className="min-h-full bg-purple-50 p-4">
      <TopNav />
      <Routes>
        <Route path="/" element={<Feed />} />
        <Route path="/post/:id" element={<GuardianPostDetail />} />
        <Route path="/kelola" element={<Admin />} />
        <Route path="/telegram" element={<TelegramSettings />} />
      </Routes>
    </div>
  )
}
