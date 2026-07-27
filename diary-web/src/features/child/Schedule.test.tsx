import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SessionProvider } from '@/auth/SessionProvider'
import Schedule from './Schedule'

const TODAY = {
  date: '2026-07-27',
  total: 2,
  done_count: 1,
  groups: [
    {
      part_of_day: 'pagi',
      items: [
        {
          id: 1,
          title: 'Sholat Subuh',
          part_of_day: 'pagi',
          kind: 'routine',
          repeat_days: [0],
          date: null,
          emoji: '',
          order: 0,
          archived: false,
          from_guardian: false,
          created_at: '',
          done: false,
        },
        {
          id: 2,
          title: 'Mengaji',
          part_of_day: 'pagi',
          kind: 'routine',
          repeat_days: [0],
          date: null,
          emoji: '',
          order: 1,
          archived: false,
          from_guardian: true,
          created_at: '',
          done: true,
        },
      ],
    },
  ],
}

function json(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function renderSchedule(handler: (url: string) => Response) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: unknown) => Promise.resolve(handler(String(input)))),
  )
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <SessionProvider>
        <MemoryRouter>
          <Schedule />
        </MemoryRouter>
      </SessionProvider>
    </QueryClientProvider>,
  )
}

afterEach(() => vi.unstubAllGlobals())

describe('Schedule', () => {
  it('renders today grouped with progress', async () => {
    renderSchedule((url) =>
      url.includes('/api/schedule/today/') ? json(200, TODAY) : json(200, {}),
    )
    expect(await screen.findByText('Sholat Subuh')).toBeInTheDocument()
    expect(screen.getByText('Mengaji')).toBeInTheDocument()
    expect(screen.getByText('1/2 selesai')).toBeInTheDocument()
  })

  it('toggling an item calls the toggle endpoint', async () => {
    const calls: string[] = []
    renderSchedule((url) => {
      calls.push(url)
      if (url.includes('/api/schedule/today/')) return json(200, TODAY)
      if (url.includes('/toggle/')) return json(200, { done: true })
      return json(200, {})
    })
    await screen.findByText('Sholat Subuh')
    await userEvent.click(screen.getAllByRole('checkbox')[0])
    await waitFor(() =>
      expect(calls.some((u) => u.includes('/toggle/'))).toBe(true),
    )
  })
})
