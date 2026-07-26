import { useSession } from '@/auth/SessionProvider'

export default function GuardianApp() {
  const { state, logout } = useSession()
  const count = state.me?.role === 'guardian' ? state.me.children.length : 0
  return (
    <div className="min-h-full bg-purple-50 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-purple-800">Ruang Cerita</h1>
        <button onClick={logout} className="text-sm text-purple-400 underline">
          Keluar
        </button>
      </header>
      <p className="mt-4 text-purple-500">{count} anak</p>
    </div>
  )
}
