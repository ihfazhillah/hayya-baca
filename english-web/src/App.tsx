import { Link, Route, Routes } from 'react-router-dom'
import { Lessons } from './pages/Lessons'
import { Custom } from './pages/Custom'
import { LessonPlayer } from './pages/LessonPlayer'

export default function App() {
  return (
    <div className="min-h-screen bg-violet-50">
      <header className="bg-[#6C5CE7] px-4 py-3 text-white shadow">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link to="/" className="text-lg font-extrabold">
            🇦🇺 English Practice
          </Link>
          <Link to="/custom" className="text-sm font-semibold underline-offset-2 hover:underline">
            Teks Sendiri
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl p-4">
        <Routes>
          <Route path="/" element={<Lessons />} />
          <Route path="/custom" element={<Custom />} />
          <Route path="/lesson/:id" element={<LessonPlayer />} />
        </Routes>
      </main>
    </div>
  )
}
