import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { ApiError } from '../api'
import { BigButton } from '../components/ui'

export function Login() {
  const { loginWithCode, loginWithPassword } = useAuth()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [mode, setMode] = useState<'code' | 'password'>('code')
  const [code, setCode] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const autoTried = useRef(false)

  // Auto-redeem when opened from a printed QR: /login?code=XXXX
  useEffect(() => {
    const c = params.get('code')
    if (!c || autoTried.current) return
    autoTried.current = true
    setCode(c)
    setBusy(true)
    loginWithCode(c)
      .then(() => nav('/', { replace: true }))
      .catch((e) =>
        setError(e instanceof ApiError ? e.message : 'Kode tidak valid.'),
      )
      .finally(() => setBusy(false))
  }, [params, loginWithCode, nav])

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await loginWithCode(code)
      nav('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Kode tidak valid.')
    } finally {
      setBusy(false)
    }
  }

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await loginWithPassword(username, password)
      nav('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal masuk.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 max-w-md mx-auto">
      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-2xl bg-teal-700 text-white text-3xl font-extrabold grid place-items-center mx-auto mb-3">
          ت
        </div>
        <div className="text-2xl font-extrabold tracking-tight">Tahsin</div>
        <div className="text-gray-500 text-sm">
          Catatan perkembangan bacaan santri
        </div>
      </div>

      {error && (
        <div className="w-full mb-3 bg-red-50 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {mode === 'code' ? (
        <form onSubmit={submitCode} className="w-full bg-white rounded-2xl p-5 border border-gray-200">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Kode pengampu
          </label>
          <input
            className="w-full rounded-xl border border-gray-200 p-3 text-center font-mono text-xl tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-teal-600"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="K7MP4XQ2"
            autoCapitalize="characters"
            maxLength={8}
          />
          <p className="text-gray-500 text-sm text-center my-3">
            Atau <b>scan QR</b> di kartu pengampu dengan kamera HP — langsung masuk.
          </p>
          <BigButton type="submit" disabled={busy || code.trim().length < 4}>
            {busy ? 'Memeriksa…' : 'Masuk'}
          </BigButton>
          <div className="text-center mt-3">
            <button
              type="button"
              className="text-teal-700 font-semibold text-sm"
              onClick={() => {
                setMode('password')
                setError(null)
              }}
            >
              Masuk sebagai ustadz →
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={submitPassword} className="w-full bg-white rounded-2xl p-5 border border-gray-200">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Username
          </label>
          <input
            className="w-full rounded-xl border border-gray-200 p-3 mb-3 focus:outline-none focus:ring-2 focus:ring-teal-600"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoCapitalize="none"
            autoComplete="username"
          />
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Password
          </label>
          <input
            type="password"
            className="w-full rounded-xl border border-gray-200 p-3 mb-4 focus:outline-none focus:ring-2 focus:ring-teal-600"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <BigButton type="submit" disabled={busy || !username || !password}>
            {busy ? 'Memeriksa…' : 'Masuk'}
          </BigButton>
          <div className="text-center mt-3">
            <button
              type="button"
              className="text-teal-700 font-semibold text-sm"
              onClick={() => {
                setMode('code')
                setError(null)
              }}
            >
              ← Punya kode pengampu
            </button>
          </div>
        </form>
      )}
      <p className="text-gray-400 text-xs text-center mt-5">
        Sekali masuk, tetap masuk di HP ini sampai kamu keluar.
      </p>
    </div>
  )
}
