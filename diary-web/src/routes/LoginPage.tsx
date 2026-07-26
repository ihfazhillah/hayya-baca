import { useState, type FormEvent } from 'react'
import { useSession } from '@/auth/SessionProvider'
import { getQuickPicks, type QuickPick } from '@/auth/quickpick'
import { ApiError } from '@/api/client'
import { Avatar, Button, Card, ErrorText, TextInput } from '@/features/shared/ui'

type Mode = 'child' | 'guardian'

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429) return 'Terlalu banyak percobaan. Coba lagi nanti.'
    const detail = (err.data as { detail?: string })?.detail
    return detail ?? 'Gagal masuk. Coba lagi.'
  }
  return 'Tidak bisa terhubung. Periksa koneksi.'
}

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('child')
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 bg-purple-50 p-6">
      <h1 className="text-3xl font-extrabold text-purple-800">Ruang Cerita</h1>
      <Card>
        <div className="mb-5 flex rounded-2xl bg-purple-100 p-1">
          <Tab active={mode === 'child'} onClick={() => setMode('child')}>
            Anak
          </Tab>
          <Tab active={mode === 'guardian'} onClick={() => setMode('guardian')}>
            Orang Tua
          </Tab>
        </div>
        {mode === 'child' ? <ChildLogin /> : <GuardianLogin />}
      </Card>
    </div>
  )
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      onClick={onClick}
      className={
        'flex-1 rounded-xl py-2 text-center font-semibold transition ' +
        (active ? 'bg-white text-purple-700 shadow' : 'text-purple-500')
      }
    >
      {children}
    </button>
  )
}

function ChildLogin() {
  const { signInChild } = useSession()
  const [picks] = useState<QuickPick[]>(() => getQuickPicks())
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await signInChild(username.trim(), password)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {picks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {picks.map((p) => (
            <button
              key={p.username}
              type="button"
              onClick={() => setUsername(p.username)}
              className={
                'flex items-center gap-2 rounded-full border-2 px-2 py-1 ' +
                (username === p.username
                  ? 'border-purple-500 bg-purple-50'
                  : 'border-transparent')
              }
            >
              <Avatar name={p.name} color={p.avatar_color} size={28} />
              <span className="pr-1 text-sm font-medium">{p.name}</span>
            </button>
          ))}
        </div>
      )}
      <TextInput
        placeholder="Nama pengguna"
        value={username}
        autoCapitalize="none"
        onChange={(e) => setUsername(e.target.value)}
      />
      <TextInput
        type="password"
        placeholder="Kata sandi"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <ErrorText>{error}</ErrorText>
      <Button type="submit" disabled={busy || !username || !password}>
        {busy ? 'Masuk…' : 'Masuk'}
      </Button>
    </form>
  )
}

function GuardianLogin() {
  const { signInGuardian } = useSession()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await signInGuardian(username.trim(), password)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <TextInput
        placeholder="Nama pengguna"
        value={username}
        autoCapitalize="none"
        onChange={(e) => setUsername(e.target.value)}
      />
      <TextInput
        type="password"
        placeholder="Kata sandi"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <ErrorText>{error}</ErrorText>
      <Button type="submit" disabled={busy || !username || !password}>
        {busy ? 'Masuk…' : 'Masuk'}
      </Button>
    </form>
  )
}
