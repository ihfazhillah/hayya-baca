import { useState, type FormEvent } from 'react'
import { useSession } from '@/auth/SessionProvider'
import { ApiError } from '@/api/client'
import { Avatar, Button, Card, ErrorText, TextInput } from '@/features/shared/ui'

export default function LockScreen() {
  const { state, signInChild, signInGuardian, logout } = useSession()
  const profile = state.lockedProfile
  const isChild = state.me?.role === 'child'
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!profile) return
    setBusy(true)
    setError('')
    try {
      const signIn = isChild ? signInChild : signInGuardian
      await signIn(profile.username, password)
      setPassword('')
    } catch (err) {
      const detail =
        err instanceof ApiError
          ? (err.data as { detail?: string })?.detail
          : undefined
      setError(detail ?? 'Kata sandi salah')
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 bg-purple-50 p-6">
      <Card>
        <div className="flex flex-col items-center gap-3">
          {profile && <Avatar name={profile.name} color={profile.avatar_color} size={64} />}
          <p className="text-lg font-bold text-purple-800">
            {profile ? profile.name : 'Terkunci'}
          </p>
          <p className="text-sm text-purple-500">Sesi terkunci. Masuk lagi ya.</p>
        </div>
        <form onSubmit={submit} className="mt-5 flex flex-col gap-3">
          <TextInput
            type="password"
            placeholder="Kata sandi"
            value={password}
            autoFocus
            onChange={(e) => setPassword(e.target.value)}
          />
          <ErrorText>{error}</ErrorText>
          <Button type="submit" disabled={busy || !password}>
            {busy ? 'Membuka…' : 'Buka'}
          </Button>
          <button
            type="button"
            onClick={logout}
            className="text-sm text-purple-400 underline"
          >
            Ganti pengguna
          </button>
        </form>
      </Card>
    </div>
  )
}
