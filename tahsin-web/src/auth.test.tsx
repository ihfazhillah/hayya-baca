import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from './auth'
import { Login } from './pages/Login'

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

function mockFetch(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  } as Response)
}

describe('Login auto-redeem from ?code=', () => {
  it('redeems the code in the URL and stores the token', async () => {
    const fetchMock = mockFetch({ token: 'tok123', name: 'Hamzah', role: 'pengampu' })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter initialEntries={['/login?code=K7MP4XQ2']}>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </MemoryRouter>,
    )

    await waitFor(() =>
      expect(localStorage.getItem('tahsin.token')).toBe('tok123'),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/tahsin/auth/login-code/',
      expect.objectContaining({ method: 'POST' }),
    )
    // The code posted matches the URL param.
    const [, opts] = fetchMock.mock.calls[0]
    expect(JSON.parse((opts as RequestInit).body as string)).toEqual({
      code: 'K7MP4XQ2',
    })
  })

  it('shows an error when the code is rejected', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({ detail: 'Kode tidak valid' }, false, 400),
    )
    render(
      <MemoryRouter initialEntries={['/login?code=ZZZZZZZZ']}>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </MemoryRouter>,
    )
    expect(await screen.findByText('Kode tidak valid')).toBeInTheDocument()
    expect(localStorage.getItem('tahsin.token')).toBeNull()
  })
})
