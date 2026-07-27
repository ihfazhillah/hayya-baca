import { useEffect, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { useSession } from '@/auth/SessionProvider'
import { useApi } from '@/features/shared/hooks'
import { ApiError } from '@/api/client'
import { Avatar, Button, TextInput } from '@/features/shared/ui'
import type { GuardianChild, SetupTokenResult } from '@/api/types'

export default function Admin() {
  const { me } = useSession()
  const children = me?.role === 'guardian' ? me.children : []
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <h2 className="text-xl font-bold text-purple-800">Kelola Akun Anak</h2>
      {children.map((child) => (
        <ChildAdminCard key={child.id} child={child} />
      ))}
    </div>
  )
}

function ChildAdminCard({ child }: { child: GuardianChild }) {
  const api = useApi()
  const [username, setUsername] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [error, setError] = useState('')
  const [hasAccount, setHasAccount] = useState(child.has_diary_account)
  const [token, setToken] = useState<SetupTokenResult | null>(null)

  const generateToken = useMutation({
    mutationFn: () => api.createSetupToken(child.id),
    onSuccess: (data) => setToken(data),
  })

  const createAccount = useMutation({
    mutationFn: () => api.createDiaryAccount(child.id, username.trim()),
    onSuccess: () => {
      setHasAccount(true)
      setError('')
      setSuggestions([])
      generateToken.mutate()
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        setSuggestions((err.data as { suggestions?: string[] }).suggestions ?? [])
        setError('Nama pengguna sudah dipakai. Coba saran di bawah.')
      } else {
        setError('Gagal membuat akun.')
      }
    },
  })

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <Avatar name={child.name} color={child.avatar_color} size={40} />
        <div>
          <p className="font-semibold text-purple-800">{child.name}</p>
          <p className="text-sm text-purple-400">
            {hasAccount ? `@${child.username ?? username}` : 'Belum punya akun'}
          </p>
        </div>
      </div>

      {!hasAccount ? (
        <div className="mt-3 flex flex-col gap-2">
          <TextInput
            placeholder="Nama pengguna anak"
            value={username}
            autoCapitalize="none"
            onChange={(e) =>
              setUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))
            }
          />
          <p className="text-xs text-purple-400">
            Huruf kecil, tanpa spasi.
          </p>
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setUsername(s)}
                  className="rounded-full bg-purple-100 px-3 py-1 text-sm text-purple-700"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button
            onClick={() => createAccount.mutate()}
            disabled={createAccount.isPending || !username.trim()}
          >
            Buat akun & kode
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <Button
            onClick={() => generateToken.mutate()}
            disabled={generateToken.isPending}
          >
            {token ? 'Buat kode baru' : 'Buat kode kata sandi'}
          </Button>
          {token && <SetupCode token={token} onExpired={() => setToken(null)} />}
        </div>
      )}
    </div>
  )
}

function SetupCode({
  token,
  onExpired,
}: {
  token: SetupTokenResult
  onExpired: () => void
}) {
  const remaining = useCountdown(token.expires_at, onExpired)
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-purple-50 p-4">
      <QRCodeSVG value={token.setup_url} size={168} />
      <p className="text-sm text-purple-500">Atau ketik kode ini:</p>
      <p className="text-3xl font-bold tracking-widest text-purple-800">
        {token.code}
      </p>
      <p className="text-xs text-purple-400">
        {remaining > 0
          ? `Berlaku ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')} lagi`
          : 'Kode kedaluwarsa'}
      </p>
    </div>
  )
}

function useCountdown(expiresAt: string, onExpired: () => void): number {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)),
  )
  useEffect(() => {
    const timer = setInterval(() => {
      const left = Math.max(
        0,
        Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000),
      )
      setRemaining(left)
      if (left <= 0) {
        clearInterval(timer)
        onExpired()
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [expiresAt, onExpired])
  return remaining
}
