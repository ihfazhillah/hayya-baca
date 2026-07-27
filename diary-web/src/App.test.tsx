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
    // Product title + the guardian unlock form (family-lobby model, Spec 061).
    expect(screen.getByRole('heading', { name: 'Ruang Cerita' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Buka' })).toBeInTheDocument()
  })
})
