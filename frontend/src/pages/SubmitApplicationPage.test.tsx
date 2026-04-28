import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SubmitApplicationPage from './SubmitApplicationPage'

vi.mock('../lib/api', () => ({ api: { post: vi.fn() } }))

describe('SubmitApplicationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all form sections', () => {
    render(
      <MemoryRouter>
        <SubmitApplicationPage />
      </MemoryRouter>
    )
    expect(screen.getByText('Basic Details')).toBeInTheDocument()
    expect(screen.getByText('Operations')).toBeInTheDocument()
    expect(screen.getByText('Documents')).toBeInTheDocument()
    expect(screen.getByText('Declarations')).toBeInTheDocument()
  })

  it('renders submit button disabled by default', () => {
    render(
      <MemoryRouter>
        <SubmitApplicationPage />
      </MemoryRouter>
    )
    const btn = screen.getByRole('button', { name: /submit application/i })
    expect(btn).toBeDisabled()
  })

  it('shows progress indicator', () => {
    render(
      <MemoryRouter>
        <SubmitApplicationPage />
      </MemoryRouter>
    )
    expect(screen.getByText(/progress/i)).toBeInTheDocument()
  })
})
