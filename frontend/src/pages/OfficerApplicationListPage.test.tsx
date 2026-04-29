import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import OfficerApplicationListPage from './OfficerApplicationListPage'

vi.mock('../lib/api', () => ({ api: { get: vi.fn() } }))
import { api } from '../lib/api'

const APP = {
  id: 'app-1',
  status: 'Application Received',
  centre_name: 'Sunshine Childcare',
  operator_name: 'Alice Operator',
  type_of_service: 'Childcare',
  current_round: 1,
  updated_at: '2026-04-28T00:00:00Z',
}

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/officer/applications']}>
      <Routes>
        <Route path="/officer/applications" element={<OfficerApplicationListPage />} />
        <Route path="/officer/applications/:id" element={<div>Detail Page</div>} />
      </Routes>
    </MemoryRouter>
  )

describe('OfficerApplicationListPage', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders application rows', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: [APP] })
    renderPage()
    expect(await screen.findByText('Sunshine Childcare')).toBeInTheDocument()
    expect(screen.getByText('Alice Operator')).toBeInTheDocument()
    const badges = screen.getAllByText('Application Received')
    expect(badges.length).toBeGreaterThanOrEqual(1)
  })

  it('shows empty state when no applications', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: [] })
    renderPage()
    expect(await screen.findByText(/no applications matching/i)).toBeInTheDocument()
  })

  it('clicking a row navigates to detail page', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: [APP] })
    renderPage()
    fireEvent.click(await screen.findByText('Sunshine Childcare'))
    expect(await screen.findByText('Detail Page')).toBeInTheDocument()
  })

  it('status filter sends correct query param', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] })
    renderPage()
    await screen.findByText(/no applications matching/i)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Under Review' } })
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/applications', { params: { status: 'Under Review' } })
    })
  })

  it('all filter sends no status param', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] })
    renderPage()
    await screen.findByText(/no applications matching/i)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '' } })
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/applications', { params: {} })
    })
  })
})
