import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import LoginPage from './LoginPage'

vi.mock('../lib/api', () => ({ api: { post: vi.fn() } }))
import { api } from '../lib/api'

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/operator" element={<div>Operator Home</div>} />
        <Route path="/officer" element={<div>Officer Home</div>} />
      </Routes>
    </MemoryRouter>
  )

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('localStorage', {
      setItem: vi.fn(),
      getItem: vi.fn(),
      removeItem: vi.fn(),
    })
  })

  it('renders username input', () => {
    renderPage()
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
  })

  it('renders password input', () => {
    renderPage()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('does not render role selector', () => {
    renderPage()
    expect(screen.queryByLabelText(/role/i)).not.toBeInTheDocument()
  })

  it('submit button is disabled when password is empty', () => {
    renderPage()
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'alice' } })
    expect(screen.getByRole('button', { name: /login/i })).toBeDisabled()
  })

  it('does not send role in API request', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { access_token: 'tok', role: 'operator' } })
    renderPage()
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'alice' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'any' } })
    const form = screen.getByRole('button', { name: /login/i }).closest('form')!
    fireEvent.submit(form)
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/login', { username: 'alice' })
    })
  })

  it('redirects to /officer for officer role', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { access_token: 'tok', role: 'officer' } })
    renderPage()
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'bob' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'any' } })
    const form = screen.getByRole('button', { name: /login/i }).closest('form')!
    fireEvent.submit(form)
    expect(await screen.findByText('Officer Home')).toBeInTheDocument()
  })

  it('redirects to /operator for operator role', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { access_token: 'tok', role: 'operator' } })
    renderPage()
    fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'alice' } })
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'any' } })
    const form = screen.getByRole('button', { name: /login/i }).closest('form')!
    fireEvent.submit(form)
    expect(await screen.findByText('Operator Home')).toBeInTheDocument()
  })
})
