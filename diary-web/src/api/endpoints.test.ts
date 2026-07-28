import { describe, expect, it, vi } from 'vitest'
import { createApiClient } from './client'
import { createEndpoints } from './endpoints'

function setup() {
  const fetchImpl = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ results: [], next: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
  const api = createEndpoints(
    createApiClient({
      getToken: () => 't',
      onUnauthorized: () => {},
      fetchImpl: fetchImpl as unknown as typeof fetch,
    }),
  )
  const url = () => fetchImpl.mock.calls[0][0] as string
  const method = () => (fetchImpl.mock.calls[0][1]?.method as string) ?? 'GET'
  return { api, url, method }
}

describe('feed endpoint query building', () => {
  it('adds type and resolved params', async () => {
    const { api, url } = setup()
    await api.feed({ child: 3, type: 'curhat', resolved: true })
    expect(url()).toContain('child=3')
    expect(url()).toContain('type=curhat')
    expect(url()).toContain('resolved=1')
  })

  it('adds the saved param for the keepsake view', async () => {
    const { api, url } = setup()
    await api.feed({ saved: true })
    expect(url()).toBe('/api/diary/feed/?saved=1')
  })

  it('omits params when not given', async () => {
    const { api, url } = setup()
    await api.feed({})
    expect(url()).toBe('/api/diary/feed/')
  })
})

describe('save endpoints', () => {
  it('savePost POSTs to the save url', async () => {
    const { api, url, method } = setup()
    await api.savePost(9)
    expect(url()).toBe('/api/diary/posts/9/save/')
    expect(method()).toBe('POST')
  })

  it('unsavePost DELETEs the save url', async () => {
    const { api, url, method } = setup()
    await api.unsavePost(9)
    expect(url()).toBe('/api/diary/posts/9/save/')
    expect(method()).toBe('DELETE')
  })
})

describe('resolve endpoints', () => {
  it('resolvePost POSTs to the resolve url', async () => {
    const { api, url, method } = setup()
    await api.resolvePost(7)
    expect(url()).toBe('/api/diary/posts/7/resolve/')
    expect(method()).toBe('POST')
  })

  it('unresolvePost DELETEs the resolve url', async () => {
    const { api, url, method } = setup()
    await api.unresolvePost(7)
    expect(url()).toBe('/api/diary/posts/7/resolve/')
    expect(method()).toBe('DELETE')
  })
})
