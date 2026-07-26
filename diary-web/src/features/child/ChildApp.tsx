import { useSession } from '@/auth/SessionProvider'

export default function ChildApp() {
  const { state, logout } = useSession()
  const name = state.me?.role === 'child' ? state.me.child.name : ''
  return (
    <div className="min-h-full bg-purple-50 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-purple-800">Halo, {name} 👋</h1>
        <button onClick={logout} className="text-sm text-purple-400 underline">
          Keluar
        </button>
      </header>
    </div>
  )
}
