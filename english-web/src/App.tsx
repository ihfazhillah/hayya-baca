import { Link, Route, Routes } from 'react-router-dom'
import { Lessons } from './pages/Lessons'
import { Custom } from './pages/Custom'
import { LessonPlayer } from './pages/LessonPlayer'
import { CreateLesson } from './pages/CreateLesson'
import { Fitness } from './pages/Fitness'
import { Login } from './pages/Login'
import { useAuth } from './auth'

export default function App() {
  const { token, username, logout } = useAuth()

  if (!token) return <Login />

  return (
    <div className="min-h-screen bg-violet-50">
      <header className="bg-[#6C5CE7] px-4 py-3 text-white shadow">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <Link to="/" className="text-lg font-extrabold">
            🇦🇺 English Practice
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <Link to="/fitness" className="font-semibold hover:underline">
              🏋️ Fitness
            </Link>
            <Link to="/custom" className="font-semibold hover:underline">
              Teks Sendiri
            </Link>
            <span className="hidden text-violet-200 sm:inline">·</span>
            <span className="hidden text-violet-100 sm:inline">{username}</span>
            <button
              onClick={logout}
              className="rounded-lg bg-white/15 px-2.5 py-1 font-semibold hover:bg-white/25"
            >
              Keluar
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl p-4">
        <Routes>
          <Route path="/" element={<Lessons />} />
          <Route path="/custom" element={<Custom />} />
          <Route path="/create" element={<CreateLesson />} />
          <Route path="/fitness" element={<Fitness />} />
          <Route path="/lesson/:id" element={<LessonPlayer />} />
        </Routes>
      </main>
    </div>
  )
}
