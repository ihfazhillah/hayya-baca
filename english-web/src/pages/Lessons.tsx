import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchLessons, type LessonListItem } from '../api'

const LEVEL_LABEL: Record<string, string> = {
  beginner: 'Pemula',
  intermediate: 'Menengah',
  advanced: 'Lanjutan',
}

export function Lessons() {
  const [lessons, setLessons] = useState<LessonListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchLessons()
      .then(setLessons)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Gagal memuat'),
      )
  }, [])

  return (
    <div>
      <Link
        to="/custom"
        className="mb-5 block rounded-2xl bg-[#6C5CE7] p-4 text-white shadow transition hover:bg-[#5A4BD1]"
      >
        <p className="text-lg font-bold">✍️ Latihan Teks Sendiri</p>
        <p className="text-sm text-violet-100">
          Ketik teks apa pun, dengarkan dengan aksen Australia, lalu tirukan.
        </p>
      </Link>

      <h2 className="mb-3 text-lg font-bold text-gray-800">📚 Lessons</h2>

      {error && <p className="text-red-500">{error}</p>}
      {!lessons && !error && <p className="text-gray-500">Memuat…</p>}
      {lessons && lessons.length === 0 && (
        <p className="text-gray-500">
          Belum ada lesson yang dipublish. Buat lewat tools/english-pipeline
          lalu import di backend.
        </p>
      )}
      <ul className="space-y-2.5">
        {lessons?.map((l) => (
          <li key={l.id}>
            <Link
              to={`/lesson/${l.id}`}
              className="block rounded-xl bg-white p-4 shadow-sm transition hover:shadow"
            >
              <p className="font-semibold text-gray-800">
                {l.source === 'youtube' ? '▶️ ' : '🎧 '}
                {l.title}
              </p>
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
