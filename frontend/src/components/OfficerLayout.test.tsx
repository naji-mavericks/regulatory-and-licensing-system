import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import OfficerLayout from './OfficerLayout'

const renderWithRouter = (initialEntry = '/officer/applications') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/officer" element={<OfficerLayout />}>
          <Route path="applications" element={<div>Applications Page</div>} />
        </Route>
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  )

describe('OfficerLayout', () => {
  beforeEach(() => {
    const store: Record<string, string> = { role: 'officer', token: 'test-token' }
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => { store[key] = value }),
      removeItem: vi.fn((key: string) => { delete store[key] }),
    })
  })

  it('renders the portal name', () => {
    renderWithRouter()
    expect(screen.getByText('Licensing Portal')).toBeInTheDocument()
  })

  it('renders Applications nav link', () => {
    renderWithRouter()
    const link = screen.getByRole('link', { name: /applications/i })
    expect(link).toHaveAttribute('href', '/officer/applications')
  })

  it('renders outlet content', () => {
    renderWithRouter()
    expect(screen.getByText('Applications Page')).toBeInTheDocument()
  })

  it('logout clears localStorage and navigates to /login', () => {
    renderWithRouter()
    fireEvent.click(screen.getByRole('button', { name: /logout/i }))
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('role')).toBeNull()
    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })
})
