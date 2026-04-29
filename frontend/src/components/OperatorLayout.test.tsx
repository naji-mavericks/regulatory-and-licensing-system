import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import OperatorLayout from './OperatorLayout'

const renderWithRouter = (initialEntry = '/operator/applications') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/operator" element={<OperatorLayout />}>
          <Route path="applications" element={<div>Applications Page</div>} />
          <Route path="apply" element={<div>Apply Page</div>} />
        </Route>
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  )

describe('OperatorLayout', () => {
  beforeEach(() => {
    const store: Record<string, string> = {
      role: 'operator',
      token: 'test-token',
    }
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => { store[key] = value }),
      removeItem: vi.fn((key: string) => { delete store[key] }),
    })
  })

  it('renders the app name', () => {
    renderWithRouter()
    expect(screen.getByText('Licensing Portal')).toBeInTheDocument()
  })

  it('renders My Applications nav link', () => {
    renderWithRouter()
    const link = screen.getByRole('link', { name: /my applications/i })
    expect(link).toHaveAttribute('href', '/operator/applications')
  })

  it('renders the outlet content', () => {
    renderWithRouter()
    expect(screen.getByText('Applications Page')).toBeInTheDocument()
  })

  it('displays the role label', () => {
    renderWithRouter()
    expect(screen.getByText(/operator/i)).toBeInTheDocument()
  })

  it('logout clears localStorage and navigates to /login', () => {
    renderWithRouter()
    fireEvent.click(screen.getByRole('button', { name: /logout/i }))
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('role')).toBeNull()
    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })
})
