/** Same-origin API — nginx proxies /api/ to the shared Django gunicorn.
 *  Auth: DRF token in localStorage, sent as `Authorization: Token <key>`.
 *  A 401 clears the token and notifies the app (→ login screen).
 */
import type {
  Item,
  LoginCode,
  Me,
  RecordInput,
  Santri,
  Summary,
  TahsinRecord,
} from './types'

const TOKEN_KEY = 'tahsin.token'
const NAME_KEY = 'tahsin.name'

export class ApiError extends Error {
  status: number
  data: unknown
  constructor(status: number, message: string, data?: unknown) {
    super(message)
    this.status = status
    this.data = data
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
export function getStoredName(): string | null {
  return localStorage.getItem(NAME_KEY)
}
export function setStoredName(name: string | null) {
  if (name) localStorage.setItem(NAME_KEY, name)
  else localStorage.removeItem(NAME_KEY)
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
    throw new ApiError(401, 'Sesi berakhir, silakan masuk lagi.')
  }
  if (!res.ok) {
    let detail = `Error ${res.status}`
    let data: unknown
    try {
      data = await res.json()
      const d = data as Record<string, unknown>
      detail = (d.detail as string) ?? String(Object.values(d)?.[0] ?? detail)
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail, data)
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

// -- Auth --
export async function loginPassword(username: string, password: string) {
  const data = await request<{ token: string }>('POST', '/api/auth/login/', {
    username,
    password,
  })
  return data.token
}
export async function loginCode(code: string) {
  return request<{ token: string; name: string; role: string }>(
    'POST',
    '/api/tahsin/auth/login-code/',
    { code },
  )
}

// -- Bootstrap --
export const getMe = () => request<Me>('GET', '/api/tahsin/me/')

// -- Items --
export const listItems = () => request<Item[]>('GET', '/api/tahsin/items/')
export const seedItems = () =>
  request<Item[]>('POST', '/api/tahsin/items/seed/', {})
export const createItem = (body: Partial<Item>) =>
  request<Item>('POST', '/api/tahsin/items/', body)
export const updateItem = (id: number, body: Partial<Item>) =>
  request<Item>('PATCH', `/api/tahsin/items/${id}/`, body)
export const deleteItem = (id: number) =>
  request<void>('DELETE', `/api/tahsin/items/${id}/`)

// -- Santri --
export const listSantri = () => request<Santri[]>('GET', '/api/tahsin/santri/')
export const createSantri = (body: Partial<Santri>) =>
  request<Santri>('POST', '/api/tahsin/santri/', body)
export const updateSantri = (id: number, body: Partial<Santri>) =>
  request<Santri>('PATCH', `/api/tahsin/santri/${id}/`, body)
export const assignSantri = (id: number, pengampu: number | null) =>
  request<Santri>('POST', `/api/tahsin/santri/${id}/assign/`, { pengampu })
export const getLoginCode = (id: number) =>
  request<LoginCode>('GET', `/api/tahsin/santri/${id}/login-code/`)
export const regenLoginCode = (id: number) =>
  request<LoginCode>('POST', `/api/tahsin/santri/${id}/login-code/regenerate/`, {})

// -- Records --
export function listRecords(params: {
  santri?: number
  pengampu?: number
  from?: string
  to?: string
}) {
  const q = new URLSearchParams()
  if (params.santri) q.set('santri', String(params.santri))
  if (params.pengampu) q.set('pengampu', String(params.pengampu))
  if (params.from) q.set('from', params.from)
  if (params.to) q.set('to', params.to)
  const qs = q.toString()
  return request<TahsinRecord[]>(
    'GET',
    `/api/tahsin/records/${qs ? '?' + qs : ''}`,
  )
}
export const createRecord = (body: RecordInput) =>
  request<TahsinRecord>('POST', '/api/tahsin/records/', body)
export const updateRecord = (id: number, body: Partial<RecordInput>) =>
  request<TahsinRecord>('PATCH', `/api/tahsin/records/${id}/`, body)
export const deleteRecord = (id: number) =>
  request<void>('DELETE', `/api/tahsin/records/${id}/`)
export const bulkRecords = (rows: RecordInput[]) =>
  request<TahsinRecord[]>('POST', '/api/tahsin/records/bulk/', rows)

// -- Summary --
export function getSummary(params: {
  period: 'week' | 'month'
  start: string
  pengampu?: number
  santri?: number
}) {
  const q = new URLSearchParams({ period: params.period, start: params.start })
  if (params.pengampu) q.set('pengampu', String(params.pengampu))
  if (params.santri) q.set('santri', String(params.santri))
  return request<Summary>('GET', `/api/tahsin/summary/?${q.toString()}`)
}
