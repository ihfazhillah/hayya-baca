import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '@/App'

function json(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

type Handler = (url: string) => Response | Promise<Response>

function stubFetch(handler: Handler) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: unknown) => Promise.resolve(handler(String(input)))),
  )
}

function renderApp(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('auth flow', () => {
  it('links from the login page to the setup page (bug 1)', () => {
    stubFetch(() => json(200, {}))
    renderApp('/')
    const link = screen.getByRole('link', { name: /buat kata sandi/i })
    expect(link).toHaveAttribute('href', '/setup')
  })
})
