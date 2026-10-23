import { vi } from 'vitest'

type Jawab = { status?: number; body?: unknown }
type Penangan = (url: string, init: RequestInit) => Jawab | Promise<Jawab>

/** Pasang fetch palsu. Kunci = "METHOD /path" (tanpa query) atau fungsi. */
export function pasangFetch(rute: Record<string, Jawab | Penangan>) {
  const panggilan: { method: string; url: string; body: unknown }[] = []
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input)
    const method = (init.method ?? 'GET').toUpperCase()
    const path = url.split('?')[0]
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body
    panggilan.push({ method, url, body })
    const r = rute[`${method} ${path}`]
    const j: Jawab = typeof r === 'function' ? await r(url, init) : (r ?? { status: 404, body: { detail: 'tidak ada' } })
    const status = j.status ?? 200
    return new Response(status === 204 ? null : JSON.stringify(j.body ?? {}), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fn)
  return panggilan
}
