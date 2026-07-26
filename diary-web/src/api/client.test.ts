import { describe, expect, it, vi } from 'vitest'
import { ApiError, createApiClient } from './client'

function jsonResponse(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('createApiClient', () => {
  it('attaches the token header', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }))
    const client = createApiClient({
      getToken: () => 'abc123',
      onUnauthorized: () => {},
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    await client.get('/api/diary/me/')
    const headers = fetchImpl.mock.calls[0][1].headers
    expect(headers['Authorization']).toBe('Token abc123')
  })

  it('calls onUnauthorized and throws on 401', async () => {
    const onUnauthorized = vi.fn()
    const client = createApiClient({
      getToken: () => 'tok',
      onUnauthorized,
      fetchImpl: (async () => jsonResponse(401, { detail: 'x' })) as typeof fetch,
    })
    await expect(client.get('/api/diary/me/')).rejects.toBeInstanceOf(ApiError)
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('throws ApiError with status + data on 4xx', async () => {
    const client = createApiClient({
      getToken: () => null,
      onUnauthorized: () => {},
      fetchImpl: (async () =>
        jsonResponse(400, { detail: 'bad' })) as typeof fetch,
    })
    await expect(client.post('/api/diary/my/posts/', {})).rejects.toMatchObject({
      status: 400,
      data: { detail: 'bad' },
    })
  })

  it('retries autosave on transient network error', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(jsonResponse(200, { id: 1 }))
    const client = createApiClient({
      getToken: () => 'tok',
      onUnauthorized: () => {},
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    const result = await client.patch('/api/diary/my/posts/1/', {}, { retries: 1 })
    expect(result).toEqual({ id: 1 })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('does not retry a 401 (no infinite loop)', async () => {
    const onUnauthorized = vi.fn()
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(401, {}))
    const client = createApiClient({
      getToken: () => 'tok',
      onUnauthorized,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })
    await expect(
      client.patch('/api/diary/my/posts/1/', {}, { retries: 3 }),
    ).rejects.toBeInstanceOf(ApiError)
    expect(fetchImpl).toHaveBeenCalledOnce()
  })
})
