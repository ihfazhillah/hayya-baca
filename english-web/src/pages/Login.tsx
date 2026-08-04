import { useState } from 'react'
import { useAuth } from '../auth'
import { ApiError } from '../api'

export function Login() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await login(username, password)
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Gagal login. Coba lagi.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-violet-50 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow"
      >
        <h1 className="text-2xl font-extrabold text-gray-800">
          🇦🇺 English Practice
        </h1>
        <p className="mb-5 mt-1 text-sm text-gray-500">
          Masuk dengan akun Hayya Baca-mu.
        </p>

        <label className="mb-1 block text-sm font-medium text-gray-600">
          Username
        </label>
        <input
          className="mb-3 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-[#6C5CE7]"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoCapitalize="none"
          autoComplete="username"
          required
        />

        <label className="mb-1 block text-sm font-medium text-gray-600">
          Password
        </label>
        <input
          type="password"
          className="mb-4 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-[#6C5CE7]"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />

        {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-[#6C5CE7] p-3 font-bold text-white shadow transition hover:bg-[#5A4BD1] disabled:opacity-50"
        >
          {busy ? 'Masuk…' : 'Masuk'}
        </button>
      </form>
    </div>
  )
}
