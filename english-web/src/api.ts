/** Same-origin API — nginx proxies /api/ to the shared Django gunicorn
 *  (identical pattern to diary-web / Ruang Cerita). Endpoints are AllowAny.
 */

export interface LessonListItem {
  id: number
  title: string
  slug: string
  source: 'custom' | 'youtube'
  level: 'beginner' | 'intermediate' | 'advanced'
  segment_count: number
}

export interface Segment {
  id: number
  order: number
  text: string
  audio_url: string
  duration_s: number
}

export interface LessonDetail {
  id: number
  title: string
  slug: string
  source: 'custom' | 'youtube'
  source_url: string
  level: string
  segments: Segment[]
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json() as Promise<T>
}

export function fetchLessons(): Promise<LessonListItem[]> {
  return getJson('/api/english/lessons/')
}

export function fetchLesson(id: string | number): Promise<LessonDetail> {
  return getJson(`/api/english/lessons/${id}/`)
}
