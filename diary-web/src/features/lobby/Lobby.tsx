import { useState, type FormEvent } from 'react'
import { useSession } from '@/auth/SessionProvider'
import { ApiError } from '@/api/client'
import { Avatar, Button, Card, ErrorText, TextInput } from '@/features/shared/ui'
import type { FamilyChild } from '@/auth/sessionStore'

const GUARDIAN_COLOR = '#6d28d9'

type Target = { kind: 'child'; child: FamilyChild } | { kind: 'guardian' }

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429) return 'Terlalu banyak percobaan. Coba lagi nanti.'
    const detail = (err.data as { detail?: string })?.detail
    return detail ?? 'Kata sandi salah'
  }
  return 'Tidak bisa terhubung. Periksa koneksi.'
}

export default function Lobby() {
  const { state, logout } = useSession()
  const family = state.family
  const [target, setTarget] = useState<Target | null>(null)

  if (!family) return null
  if (target) return <PasswordPrompt target={target} onBack={() => setTarget(null)} />

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 bg-purple-50 p-6">
      <h1 className="text-2xl font-extrabold text-purple-800">
        Siapa yang mau cerita?
      </h1>
      <div className="grid w-full max-w-sm grid-cols-2 gap-4">
        {family.children.map((c) => (
          <ProfileTile
            key={c.id}
            name={c.name}
            color={c.avatar_color}
            disabled={!c.has_diary_account}
            hint={c.has_diary_account ? undefined : 'Belum ada akun'}
            onClick={() => setTarget({ kind: 'child', child: c })}
          />
        ))}
        <ProfileTile
          name="Orang Tua"
          color={GUARDIAN_COLOR}
          onClick={() => setTarget({ kind: 'guardian' })}
        />
      </div>
      <button onClick={logout} className="text-sm text-purple-400 underline">
        Keluar
      </button>
    </div>
  )
}

function ProfileTile({
  name,
  color,
  disabled = false,
  hint,
  onClick,
}: {
  name: string
  color: string
  disabled?: boolean
  hint?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-2 rounded-3xl bg-white p-4 shadow-sm transition active:scale-95 disabled:opacity-50"
    >
      <Avatar name={name} color={color} size={64} />
      <span className="font-semibold text-purple-800">{name}</span>
      {hint && <span className="text-xs text-purple-400">{hint}</span>}
    </button>
  )
}

function PasswordPrompt({
  target,
  onBack,
}: {
  target: Target
  onBack: () => void
}) {
  const { enterChild, enterGuardian } = useSession()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const name = target.kind === 'child' ? target.child.name : 'Orang Tua'
  const color =
    target.kind === 'child' ? target.child.avatar_color : GUARDIAN_COLOR

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (target.kind === 'child') {
        await enterChild(target.child.username ?? '', password)
      } else {
        await enterGuardian(password)
      }
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 bg-purple-50 p-6">
      <Card>
        <div className="flex flex-col items-center gap-3">
          <Avatar name={name} color={color} size={64} />
          <p className="text-lg font-bold text-purple-800">{name}</p>
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
            {busy ? 'Masuk…' : 'Masuk'}
          </Button>
          <button
            type="button"
            onClick={onBack}
            className="text-sm text-purple-400 underline"
          >
            ← Pilih profil lain
          </button>
        </form>
      </Card>
    </div>
  )
}
