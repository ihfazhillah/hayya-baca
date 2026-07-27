import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '@/App'

const GUARDIAN_ME = {
  role: 'guardian',
  user_id: 5,
  telegram_linked: false,
  children: [
    {
      id: 1,
      name: 'Ahmad',
      age: 8,
      avatar_color: '#111',
      coins: 0,
      stars: 0,
      created_at: '',
      has_diary_account: true,
      username: 'ahmad',
    },
  ],
}

const CHILD_ME = {
  role: 'child',
  user_id: 10,
  child: {
    id: 1,
    name: 'Ahmad',
    age: 8,
    avatar_color: '#111',
    coins: 0,
    stars: 0,
    created_at: '',
  },
}

const POST_DETAIL = {
  id: 5,
  type: 'curhat',
  title: '',
  body: { type: 'doc', content: [] },
  status: 'published',
  published_at: '',
  created_at: '',
  updated_at: '',
  child: { id: 1, name: 'Ahmad', avatar_color: '#111' },
  panels: [],
  comments: [],
  reactions: { counts: {}, mine: [] },
  read_by: [],
}

function json(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>

function defaultHandler(url: string, init: RequestInit): Response {
  const auth =
    ((init.headers as Record<string, string>) ?? {})['Authorization'] ?? ''
  if (url.includes('/api/auth/login/')) return json(200, { token: 'gtok' })
  if (url.includes('/api/auth/child-login/')) return json(200, { token: 'ctok' })
  if (url.includes('/api/auth/child-setup/')) return json(200, { token: 'ctok' })
  if (url.includes('/api/diary/me/'))
    return json(200, auth.includes('ctok') ? CHILD_ME : GUARDIAN_ME)
  if (url.includes('/api/diary/feed/'))
    return json(200, { results: [], next: null, previous: null })
  if (url.includes('/api/diary/badges/'))
    return json(200, { children: [], total: 0, posts: [] })
  return json(200, [])
}

function stubFetch(handler: Handler = defaultHandler) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: unknown, init?: RequestInit) =>
      Promise.resolve(handler(String(input), init ?? {})),
    ),
  )
}

function renderApp(path = '/') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function seedFamily() {
  localStorage.setItem(
    'ruangcerita.family',
    JSON.stringify({
      guardianUsername: 'ayah',
      children: [
        {
          id: 1,
          name: 'Ahmad',
          avatar_color: '#111',
          username: 'ahmad',
          has_diary_account: true,
        },
      ],
    }),
  )
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

describe('family login (lobby-first)', () => {
  it('first run: the lobby Orang Tua tile logs the guardian in directly', async () => {
    stubFetch()
    renderApp()
    await userEvent.click(await screen.findByText('Orang Tua'))
    await userEvent.type(
      screen.getByPlaceholderText('Nama pengguna orang tua'),
      'ayah',
    )
    await userEvent.type(screen.getByPlaceholderText('Kata sandi'), 'rahasia')
    await userEvent.click(screen.getByRole('button', { name: 'Masuk' }))
    expect(await screen.findByText('Kelola Anak')).toBeInTheDocument()
  })

  it('cached family: tap a child + child password → ChildApp', async () => {
    seedFamily()
    stubFetch()
    renderApp()
    await userEvent.click(await screen.findByText('Ahmad'))
    await userEvent.type(screen.getByPlaceholderText('Kata sandi'), 'anakpass')
    await userEvent.click(screen.getByRole('button', { name: 'Masuk' }))
    expect(await screen.findByText('Halo, Ahmad')).toBeInTheDocument()
  })

  it('cached family: Orang Tua tile asks only for the password', async () => {
    seedFamily()
    stubFetch()
    renderApp()
    await userEvent.click(await screen.findByText('Orang Tua'))
    expect(
      screen.queryByPlaceholderText('Nama pengguna orang tua'),
    ).not.toBeInTheDocument()
    await userEvent.type(screen.getByPlaceholderText('Kata sandi'), 'rahasia')
    await userEvent.click(screen.getByRole('button', { name: 'Masuk' }))
    expect(await screen.findByText('Kelola Anak')).toBeInTheDocument()
  })

  it('a wrong child password shows an error and stays on the prompt', async () => {
    seedFamily()
    stubFetch((url, init) =>
      url.includes('/api/auth/child-login/')
        ? json(401, { detail: 'Username atau password salah' })
        : defaultHandler(url, init),
    )
    renderApp()
    await userEvent.click(await screen.findByText('Ahmad'))
    await userEvent.type(screen.getByPlaceholderText('Kata sandi'), 'salah')
    await userEvent.click(screen.getByRole('button', { name: 'Masuk' }))
    expect(
      await screen.findByText('Username atau password salah'),
    ).toBeInTheDocument()
    expect(screen.getByText('← Pilih profil lain')).toBeInTheDocument()
  })

  it('reload restores the lobby (family cache), not a live profile', async () => {
    seedFamily()
    stubFetch()
    renderApp()
    expect(await screen.findByText('Siapa yang mau cerita?')).toBeInTheDocument()
    expect(screen.queryByText('Halo, Ahmad')).not.toBeInTheDocument()
  })

  it('a /post/5 deep link lands on the post after entering guardian mode', async () => {
    seedFamily()
    stubFetch((url, init) => {
      if (url.includes('/api/diary/posts/5/seen/')) return json(200, { read_by: [] })
      if (url.includes('/api/diary/posts/5/')) return json(200, POST_DETAIL)
      return defaultHandler(url, init)
    })
    renderApp('/post/5')
    await userEvent.click(await screen.findByText('Orang Tua'))
    await userEvent.type(screen.getByPlaceholderText('Kata sandi'), 'rahasia')
    await userEvent.click(screen.getByRole('button', { name: 'Masuk' }))
    expect(await screen.findByText('← Beranda')).toBeInTheDocument()
  })

  it('setup via code logs the child straight into ChildApp', async () => {
    stubFetch()
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
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Buat Kata Sandi' }),
      ).not.toBeInTheDocument(),
    )
  })
})
