import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ApplicationListPage from './ApplicationListPage'

// Mock the api module
vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}))

import { api } from '../lib/api'

describe('ApplicationListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders empty state when no applications', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: [] })
    render(
      <MemoryRouter>
        <ApplicationListPage />
      </MemoryRouter>
    )
    expect(await screen.findByText(/no applications/i)).toBeInTheDocument()
  })

  it('renders application cards', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: [
        {
          id: 'app-1',
          status: 'Submitted',
          centre_name: 'Sunshine Childcare',
          type_of_service: 'Childcare',
          current_round: 1,
          updated_at: '2026-04-27T00:00:00Z',
        },
      ],
    })
    render(
      <MemoryRouter>
        <ApplicationListPage />
      </MemoryRouter>
    )
    expect(await screen.findByText('Sunshine Childcare')).toBeInTheDocument()
    expect(screen.getByText('Submitted')).toBeInTheDocument()
  })

  it('has a new application button linking to /operator/apply', () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: [] })
    render(
      <MemoryRouter>
        <ApplicationListPage />
      </MemoryRouter>
    )
    const link = screen.getByRole('link', { name: /new application/i })
    expect(link).toHaveAttribute('href', '/operator/apply')
  })
})
