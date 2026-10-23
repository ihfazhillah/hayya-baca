import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth'

export default function Masuk() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [pesan, setPesan] = useState<string | null>(null)
  const [sibuk, setSibuk] = useState(false)

  async function kirim(e: FormEvent) {
    e.preventDefault()
    setSibuk(true)
    setPesan(null)
    try {
      await login(username, password)
    } catch (err) {
      setPesan(err instanceof Error ? err.message : 'Belum bisa masuk.')
    } finally {
      setSibuk(false)
    }
  }

  return (
    <main className="page">
      <div className="layar" style={{ maxWidth: 440 }}>
        <div style={{ fontSize: '3rem' }} aria-hidden="true">📚</div>
        <p className="nav-course-label">Penerbit Rumah</p>
        <h1 className="page-title">Selamat datang, penulis!</h1>
        <form onSubmit={kirim} className="tumpuk" style={{ marginTop: 'var(--space-8)' }}>
          <label className="tumpuk" style={{ display: 'block' }}>
            <span>Nama pengguna</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoCapitalize="off"
              autoComplete="username"
              required
              style={{ width: '100%', fontSize: 'var(--text-xl)', padding: 'var(--space-3)' }}
            />
          </label>
          <label className="tumpuk" style={{ display: 'block' }}>
            <span>Kata sandi</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              style={{ width: '100%', fontSize: 'var(--text-xl)', padding: 'var(--space-3)' }}
            />
          </label>
          <p className="kecil">Kamu akan tetap masuk di perangkat ini.</p>
          {pesan && <p role="alert">{pesan}</p>}
          <button className="btn-besar" type="submit" disabled={sibuk}>Masuk</button>
        </form>
      </div>
    </main>
  )
}
