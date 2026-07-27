import { Route, Routes, useNavigate } from 'react-router-dom'
import { useSession } from '@/auth/SessionProvider'
import { Avatar } from '@/features/shared/ui'
import Timeline from './Timeline'
import TypePicker from './TypePicker'
import Editor from './Editor'
import ComicComposer from './ComicComposer'
import ChildPostDetail from './ChildPostDetail'

function ChildHeader() {
  const { me, switchProfile } = useSession()
  const navigate = useNavigate()
  if (me?.role !== 'child') return null
  const child = me.child
  return (
    <header className="mx-auto mb-5 flex max-w-xl items-center justify-between">
      <div className="flex items-center gap-2">
        <Avatar name={child.name} color={child.avatar_color} size={40} />
        <h1 className="text-lg font-bold text-purple-800">Halo, {child.name}</h1>
      </div>
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

export default function ChildApp() {
  return (
    <div className="min-h-full bg-purple-50 p-4">
      <ChildHeader />
      <Routes>
        <Route path="/" element={<Timeline />} />
        <Route path="/new" element={<TypePicker />} />
        <Route path="/tulis/:id" element={<Editor />} />
        <Route path="/komik/:id" element={<ComicComposer />} />
        <Route path="/post/:id" element={<ChildPostDetail />} />
      </Routes>
    </div>
  )
}
