import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '@/auth/SessionProvider'
import { ApiError } from '@/api/client'
import { Button, Card, ErrorText, TextInput } from '@/features/shared/ui'

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429) return 'Terlalu banyak percobaan. Coba lagi nanti.'
    const detail = (err.data as { detail?: string })?.detail
    return detail ?? 'Gagal masuk. Coba lagi.'
  }
  if (err instanceof Error && err.message) return err.message
  return 'Tidak bisa terhubung. Periksa koneksi.'
}

export default function LoginPage() {
  const { unlock } = useSession()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await unlock(username.trim(), password)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 bg-purple-50 p-6">
      <h1 className="text-3xl font-extrabold text-purple-800">Ruang Cerita</h1>
      <Card>
        <p className="mb-4 text-center text-sm text-purple-500">
          Masuk sebagai orang tua untuk membuka perangkat keluarga.
        </p>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <TextInput
            placeholder="Nama pengguna orang tua"
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
            {busy ? 'Membuka…' : 'Buka'}
          </Button>
          <Link
            to="/setup"
            className="text-center text-sm font-medium text-purple-500 underline"
          >
            Anak baru? Buat kata sandi →
          </Link>
        </form>
      </Card>
    </div>
  )
}
