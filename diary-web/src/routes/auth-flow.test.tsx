import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '@/App'
import { getQuickPicks } from '@/auth/quickpick'

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

beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

describe('auth flow', () => {
  it('links from the login page to the setup page (bug 1)', () => {
    stubFetch(() => json(200, {}))
    renderApp('/')
    const link = screen.getByRole('link', { name: /buat kata sandi/i })
    expect(link).toHaveAttribute('href', '/setup')
  })

  it('surfaces the error inline and stays on the login form when the password is wrong (bug 3)', async () => {
    stubFetch((url) =>
      url.includes('/api/auth/child-login/')
        ? json(401, { detail: 'Username atau password salah' })
        : json(200, {}),
    )
    renderApp('/')
    await userEvent.type(screen.getByPlaceholderText('Nama pengguna'), 'budi')
    await userEvent.type(screen.getByPlaceholderText('Kata sandi'), 'salahsandi')
    await userEvent.click(screen.getByRole('button', { name: 'Masuk' }))

    expect(
      await screen.findByText('Username atau password salah'),
    ).toBeInTheDocument()
    // Still on the login screen — must NOT flip to the lock screen.
    expect(screen.getByText('Orang Tua')).toBeInTheDocument()
    expect(
      screen.queryByText('Sesi terkunci. Masuk lagi ya.'),
    ).not.toBeInTheDocument()
  })

  it('navigates into the app after a successful setup (bug 2)', async () => {
    stubFetch((url) => {
      if (url.includes('/api/auth/child-setup/'))
        return json(200, {
          token: 'tok',
          username: 'budi_hebat',
          child: { id: 1, name: 'Budi', avatar_color: '#f00' },
        })
      if (url.includes('/api/diary/me/'))
        return json(200, {
          role: 'child',
          user_id: 1,
          child: {
            id: 1,
            name: 'Budi',
            age: null,
            avatar_color: '#f00',
            coins: 0,
            stars: 0,
            created_at: '2026-01-01',
          },
        })
      return json(200, [])
    })
    renderApp('/setup?code=ABCD1234')
    await userEvent.type(
      screen.getByPlaceholderText('Kata sandi baru'),
      'rahasia1',
    )
    await userEvent.type(
      screen.getByPlaceholderText('Ulangi kata sandi'),
      'rahasia1',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Simpan & Masuk' }))

    // Leaving /setup means the setup heading is gone.
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Buat Kata Sandi' }),
      ).not.toBeInTheDocument(),
    )

    // Quick-pick keeps the real login id, not the display name (bug 8).
    const picks = getQuickPicks()
    expect(picks[0]?.username).toBe('budi_hebat')
    expect(picks[0]?.name).toBe('Budi')
  })
})
