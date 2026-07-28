import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSession } from '@/auth/SessionProvider'
import { ApiError } from '@/api/client'
import {
  Button,
  Card,
  ErrorText,
  PasswordInput,
  TextInput,
} from '@/features/shared/ui'

export default function SetupPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { completeSetup } = useSession()
  const [code, setCode] = useState(params.get('code') ?? '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setError('Kata sandi tidak sama')
      return
    }
    if (password.length < 6) {
      setError('Kata sandi minimal 6 karakter')
      return
    }
    setBusy(true)
    setError('')
    try {
      await completeSetup(code.trim().toUpperCase(), password)
      // Session is now live; hand off to AuthGate (stay busy through the nav).
      navigate('/', { replace: true })
    } catch (err) {
      const detail =
        err instanceof ApiError
          ? (err.data as { detail?: string })?.detail
          : undefined
      setError(detail ?? 'Gagal. Periksa kode.')
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 bg-purple-50 p-6">
      <h1 className="text-2xl font-extrabold text-purple-800">Buat Kata Sandi</h1>
      <Card>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <TextInput
            placeholder="Kode dari orang tua"
            value={code}
            autoCapitalize="characters"
            onChange={(e) => setCode(e.target.value)}
          />
          <PasswordInput
            placeholder="Kata sandi baru"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <PasswordInput
            placeholder="Ulangi kata sandi"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <ErrorText>{error}</ErrorText>
          <Button type="submit" disabled={busy || !code || !password}>
            {busy ? 'Menyimpan…' : 'Simpan & Masuk'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
