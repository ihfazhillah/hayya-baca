// Fetch wrapper: attaches the in-memory token, converts non-2xx to ApiError,
// and calls onUnauthorized (→ session lock) on 401 (Spec 060 §3.4).

export class ApiError extends Error {
  status: number
  data: unknown
  constructor(status: number, data: unknown, message?: string) {
    super(message ?? `API error ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

export interface ApiClientOptions {
  getToken: () => string | null
  onUnauthorized: () => void
  baseUrl?: string
  // Injectable for tests.
  fetchImpl?: typeof fetch
}

interface RequestOptions {
  // Retry idempotent saves through transient network errors (autosave).
  retries?: number
}

const isFormData = (v: unknown): v is FormData =>
  typeof FormData !== 'undefined' && v instanceof FormData

export function createApiClient(opts: ApiClientOptions) {
  const baseUrl = opts.baseUrl ?? ''
  const doFetch = opts.fetchImpl ?? fetch

  async function request<T>(
    method: string,
    path: string,
    body?: unknown,
    { retries = 0 }: RequestOptions = {},
  ): Promise<T> {
    const headers: Record<string, string> = {}
    const token = opts.getToken()
    if (token) headers['Authorization'] = `Token ${token}`

    let payload: BodyInit | undefined
    if (body !== undefined) {
      if (isFormData(body)) {
        payload = body
      } else {
        headers['Content-Type'] = 'application/json'
        payload = JSON.stringify(body)
      }
    }

    let attempt = 0
    // Retry only the network-failure case; HTTP errors are returned as-is.
    for (;;) {
      try {
        const res = await doFetch(baseUrl + path, {
          method,
          headers,
          body: payload,
        })
        return await handleResponse<T>(res)
      } catch (err) {
        if (err instanceof ApiError) throw err
        if (attempt < retries) {
          attempt += 1
          continue
        }
        throw err
      }
    }
  }

  async function handleResponse<T>(res: Response): Promise<T> {
    // A 401 on an authenticated request means the session lapsed → lock.
    // (Login/setup calls use a client whose onUnauthorized is a no-op, so a
    // wrong password surfaces as an ApiError instead of locking the app.)
    if (res.status === 401) opts.onUnauthorized()
    if (res.status === 204) return undefined as T

    let data: unknown = null
    const text = await res.text()
    if (text) {
      try {
        data = JSON.parse(text)
      } catch {
        data = text
      }
    }

    if (!res.ok) {
      throw new ApiError(res.status, data)
    }
    return data as T
  }

  return {
    request,
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body?: unknown, o?: RequestOptions) =>
      request<T>('POST', path, body, o),
    patch: <T>(path: string, body?: unknown, o?: RequestOptions) =>
      request<T>('PATCH', path, body, o),
    put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
    del: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
  }
}

export type ApiClient = ReturnType<typeof createApiClient>
