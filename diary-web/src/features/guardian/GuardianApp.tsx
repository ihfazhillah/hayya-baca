import { NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { useSession } from '@/auth/SessionProvider'
import Feed from './Feed'
import GuardianPostDetail from './GuardianPostDetail'
import Admin from './Admin'
import GuardianSchedule from './GuardianSchedule'
import TelegramSettings from './TelegramSettings'
import Settings from './Settings'
import Kenangan from './Kenangan'

function TopNav() {
  const { switchProfile } = useSession()
  const navigate = useNavigate()
  const link = ({ isActive }: { isActive: boolean }) =>
    'shrink-0 whitespace-nowrap rounded-full px-3 py-1 text-sm font-medium ' +
    (isActive ? 'bg-purple-600 text-white' : 'text-purple-600')
  return (
    <header className="mx-auto mb-4 flex max-w-xl flex-col gap-2">
      <div className="flex justify-end">
        <button
          onClick={() => {
            switchProfile()
            navigate('/')
          }}
          className="text-sm text-purple-400 underline"
        >
          Ganti profil
        </button>
      </div>
      {/* Horizontal scroll keeps the nav from overflowing narrow phones (S22). */}
      <nav className="flex gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <NavLink to="/" end className={link}>
          Beranda
        </NavLink>
        <NavLink to="/kenangan" className={link}>
          Kenangan
        </NavLink>
        <NavLink to="/kelola" className={link}>
          Kelola Anak
        </NavLink>
        <NavLink to="/telegram" className={link}>
          Telegram
        </NavLink>
        <NavLink to="/pengaturan" className={link}>
          Pengaturan
        </NavLink>
      </nav>
    </header>
  )
}

export default function GuardianApp() {
  return (
    <div className="min-h-full bg-purple-50 p-4">
      <TopNav />
      <Routes>
        <Route path="/" element={<Feed />} />
        <Route path="/kenangan" element={<Kenangan />} />
        <Route path="/post/:id" element={<GuardianPostDetail />} />
        <Route path="/kelola" element={<Admin />} />
        <Route path="/jadwal/:childId" element={<GuardianSchedule />} />
        <Route path="/telegram" element={<TelegramSettings />} />
        <Route path="/pengaturan" element={<Settings />} />
      </Routes>
    </div>
  )
}
