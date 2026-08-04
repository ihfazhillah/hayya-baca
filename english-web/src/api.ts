/** Same-origin API — nginx proxies /api/ to the shared Django gunicorn.
 *  All english endpoints require a DRF token (Spec 064): stored in
 *  localStorage, attached as `Authorization: Token <key>`. A 401 clears the
 *  token and notifies the app (→ back to the login screen).
 */

const TOKEN_KEY = 'english.token'
const USER_KEY = 'english.user'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}
export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}
export function getStoredUsername(): string | null {
  return localStorage.getItem(USER_KEY)
}
export function setStoredUsername(username: string | null) {
  if (username) localStorage.setItem(USER_KEY, username)
  else localStorage.removeItem(USER_KEY)
}

let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Token ${token}`
  let payload: string | undefined
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  const res = await fetch(path, { method, headers, body: payload })
  if (res.status === 401) {
    setToken(null)
    onUnauthorized?.()
    throw new ApiError(401, 'Sesi berakhir, silakan login lagi.')
  }
  if (!res.ok) {
    let detail = `API error ${res.status}`
    try {
      const data = await res.json()
      detail = data.detail ?? Object.values(data)?.[0] ?? detail
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, String(detail))
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export async function loginRequest(
  username: string,
  password: string,
): Promise<string> {
  const data = await request<{ token: string }>('POST', '/api/auth/login/', {
    username,
    password,
  })
  return data.token
}

// ---------------------------------------------------------------------------
// Lessons
// ---------------------------------------------------------------------------
export type AudioStatus = 'pending' | 'processing' | 'ready' | 'failed'

export interface LessonListItem {
  id: number
  title: string
  slug: string
  source: 'custom' | 'youtube'
  level: 'beginner' | 'intermediate' | 'advanced'
  segment_count: number
  is_owner: boolean
  is_public: boolean
  audio_status: AudioStatus
}

export interface Segment {
  id: number
  order: number
  text: string
  audio_url: string | null
  duration_s: number
}

export interface LessonDetail {
  id: number
  title: string
  slug: string
  source: 'custom' | 'youtube'
  source_url: string
  level: string
  is_owner: boolean
  is_public: boolean
  audio_status: AudioStatus
  error: string
  segments: Segment[]
}

export interface CreateLessonInput {
  title: string
  level: string
  text: string
  is_public: boolean
}

export const fetchLessons = () =>
  request<LessonListItem[]>('GET', '/api/english/lessons/')

export const fetchLesson = (id: string | number) =>
  request<LessonDetail>('GET', `/api/english/lessons/${id}/`)

export const createLesson = (data: CreateLessonInput) =>
  request<{ id: number }>('POST', '/api/english/lessons/', data)

export const patchLesson = (
  id: number,
  data: Partial<{ title: string; level: string; is_public: boolean }>,
) => request<LessonListItem>('PATCH', `/api/english/lessons/${id}/`, data)

export const deleteLesson = (id: number) =>
  request<void>('DELETE', `/api/english/lessons/${id}/`)

// ---------------------------------------------------------------------------
// Fitness Lidah (Spec 066)
// ---------------------------------------------------------------------------
export interface WeakPoint {
  phoneme: string
  fail_count: number
  pass_streak: number
  total_attempts: number
  status: 'tracking' | 'active' | 'cleared'
}

export const fetchWeakpoints = () =>
  request<WeakPoint[]>('GET', '/api/english/weakpoints/')

export const recordWeakpoints = (
  deltas: { phoneme: string; pass: number; fail: number }[],
) => request<WeakPoint[]>('POST', '/api/english/weakpoints/record/', deltas)

// ---------------------------------------------------------------------------
// Daily streak (Spec 068)
// ---------------------------------------------------------------------------
export interface Streak {
  current_streak: number
  longest_streak: number
  last_practice_date: string | null
  practiced_today: boolean
}

export const fetchStreak = () => request<Streak>('GET', '/api/english/streak/')
export const pingStreak = () =>
  request<Streak>('POST', '/api/english/streak/ping/')
