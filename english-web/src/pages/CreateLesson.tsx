import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, createLesson } from '../api'

const LEVELS = [
  { value: 'beginner', label: 'Pemula' },
  { value: 'intermediate', label: 'Menengah' },
  { value: 'advanced', label: 'Lanjutan' },
] as const

export function CreateLesson() {
  const nav = useNavigate()
  const [title, setTitle] = useState('')
  const [level, setLevel] = useState('beginner')
  const [text, setText] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await createLesson({ title: title.trim(), level, text, is_public: isPublic })
      nav('/') // list shows the new lesson as "diproses" and polls until ready
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal membuat lesson.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <h2 className="mb-1 text-xl font-extrabold text-gray-800">
        ➕ Buat Lesson
      </h2>
      <p className="mb-4 text-sm text-gray-500">
        Ketik teks bahasa Inggris. Audio aksen Australia dibuat otomatis di
        server (butuh beberapa saat).
      </p>

      <label className="mb-1 block text-sm font-medium text-gray-600">Judul</label>
      <input
        className="mb-3 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-[#6C5CE7]"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />

      <label className="mb-1 block text-sm font-medium text-gray-600">Level</label>
      <select
        className="mb-3 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-[#6C5CE7]"
        value={level}
        onChange={(e) => setLevel(e.target.value)}
      >
        {LEVELS.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
          </option>
        ))}
      </select>

      <label className="mb-1 block text-sm font-medium text-gray-600">
        Teks (English)
      </label>
      <textarea
        className="mb-3 min-h-40 w-full rounded-xl border border-gray-200 bg-white p-3 outline-none focus:ring-2 focus:ring-[#6C5CE7]"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Tulis paragraf English. Tiap kalimat jadi satu segmen latihan."
        required
      />

      <label className="mb-4 flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setIsPublic(e.target.checked)}
          className="h-4 w-4"
        />
        Jadikan publik (bisa dilihat semua akun)
      </label>

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => nav('/')}
          className="flex-1 rounded-xl bg-white p-3 font-semibold text-gray-600 shadow-sm"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={busy}
          className="flex-1 rounded-xl bg-[#6C5CE7] p-3 font-bold text-white shadow hover:bg-[#5A4BD1] disabled:opacity-50"
        >
          {busy ? 'Menyimpan…' : 'Buat & Generate Audio'}
        </button>
      </div>
    </form>
  )
}
