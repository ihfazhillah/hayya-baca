import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('shows the login screen when unauthenticated', () => {
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    )
    // Product title + the child/guardian tabs of the login screen.
    expect(screen.getByRole('heading', { name: 'Ruang Cerita' })).toBeInTheDocument()
    expect(screen.getByText('Orang Tua')).toBeInTheDocument()
  })
})
