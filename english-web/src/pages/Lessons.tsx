import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchLessons, type LessonListItem } from '../api'

const LEVEL_LABEL: Record<string, string> = {
  beginner: 'Pemula',
  intermediate: 'Menengah',
  advanced: 'Lanjutan',
}

function Badge({ lesson }: { lesson: LessonListItem }) {
  if (lesson.audio_status === 'processing' || lesson.audio_status === 'pending')
    return (
      <span className="whitespace-nowrap rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
        ⏳ Diproses…
      </span>
    )
  if (lesson.audio_status === 'failed')
    return (
      <span className="whitespace-nowrap rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
        ⚠️ Gagal
      </span>
    )
  if (lesson.is_public)
    return (
      <span className="whitespace-nowrap rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
        🌐 Publik
      </span>
    )
  if (lesson.is_owner)
    return (
      <span className="whitespace-nowrap rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
        🔒 Privat
      </span>
    )
  return null
}

export function Lessons() {
  const [lessons, setLessons] = useState<LessonListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const data = await fetchLessons()
        if (!alive) return
        setLessons(data)
        // Keep polling while any of my lessons is still generating audio.
        const generating = data.some(
          (l) =>
            l.is_owner &&
            (l.audio_status === 'pending' || l.audio_status === 'processing'),
        )
        if (generating) timer.current = setTimeout(load, 4000)
      } catch (e: unknown) {
        if (alive) setError(e instanceof Error ? e.message : 'Gagal memuat')
      }
    }
    load()
    return () => {
      alive = false
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  return (
    <div>
      <Link
        to="/create"
        className="mb-3 block rounded-2xl bg-[#6C5CE7] p-4 text-white shadow transition hover:bg-[#5A4BD1]"
      >
        <p className="text-lg font-bold">➕ Buat Lesson</p>
        <p className="text-sm text-violet-100">
          Ketik teks English; audio aksen Australia dibuat otomatis di server.
        </p>
      </Link>

      <Link
        to="/custom"
        className="mb-5 block rounded-2xl bg-white p-4 shadow-sm transition hover:shadow"
      >
        <p className="font-bold text-gray-800">✍️ Latihan Teks Sendiri</p>
        <p className="text-sm text-gray-500">
          Latihan cepat tanpa menyimpan — dengar &amp; tirukan.
        </p>
      </Link>

      <h2 className="mb-3 text-lg font-bold text-gray-800">📚 Lessons</h2>

      {error && <p className="text-red-500">{error}</p>}
      {!lessons && !error && <p className="text-gray-500">Memuat…</p>}
      {lessons && lessons.length === 0 && (
        <p className="text-gray-500">
          Belum ada lesson. Buat lesson pertamamu lewat tombol di atas.
        </p>
      )}
      <ul className="space-y-2.5">
        {lessons?.map((l) => (
          <li key={l.id}>
            <Link
              to={`/lesson/${l.id}`}
              className="block rounded-xl bg-white p-4 shadow-sm transition hover:shadow"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-gray-800">
                  {l.source === 'youtube' ? '▶️ ' : '🎧 '}
                  {l.title}
                </p>
                <Badge lesson={l} />
              </div>
              <p className="mt-0.5 text-sm text-gray-500">
                {LEVEL_LABEL[l.level] ?? l.level} · {l.segment_count} segmen
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
