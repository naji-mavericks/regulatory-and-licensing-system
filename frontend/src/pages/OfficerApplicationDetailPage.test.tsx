import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import OfficerApplicationDetailPage from './OfficerApplicationDetailPage'

vi.mock('../lib/api', () => ({ api: { get: vi.fn() } }))
import { api } from '../lib/api'

const makeApp = (rounds: number) => ({
  id: 'app-1',
  status: 'Application Received',
  current_round: rounds,
  operator: { id: 'op-1', full_name: 'Alice Operator', email: 'alice@test.com', phone: '+65 1111 1111' },
  submissions: Array.from({ length: rounds }, (_, i) => ({
    id: `sub-${i + 1}`,
    round_number: i + 1,
    submitted_at: '2026-04-28T00:00:00Z',
    form_data: {
      basic_details: {
        centre_name: i === 0 ? 'Original Name' : 'Updated Name',
        operator_company_name: 'Co', uen: '123', contact_person: 'Alice',
        contact_email: 'alice@test.com', contact_phone: '123',
      },
      operations: { centre_address: 'Addr', type_of_service: 'Childcare', proposed_capacity: 30 },
      declarations: { compliance_confirmed: true },
    },
    documents: [
      { id: `doc-s-${i + 1}`, doc_type: 'staff_qualification', filename: 'staff.pdf', ai_status: 'pass', ai_details: null },
      { id: `doc-f-${i + 1}`, doc_type: 'fire_safety', filename: 'fire.pdf', ai_status: 'pass', ai_details: null },
      { id: `doc-p-${i + 1}`, doc_type: 'floor_plan', filename: 'plan.pdf', ai_status: 'pass', ai_details: null },
    ],
    feedback_items: [],
  })),
})

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/officer/applications/app-1']}>
      <Routes>
        <Route path="/officer/applications/:id" element={<OfficerApplicationDetailPage />} />
        <Route path="/officer/applications" element={<div>List Page</div>} />
      </Routes>
    </MemoryRouter>
  )

describe('OfficerApplicationDetailPage', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('shows centre name and operator info', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: makeApp(1) })
    renderPage()
    expect(await screen.findByRole('heading', { name: /original name/i })).toBeInTheDocument()
    expect(screen.getByText(/alice operator/i)).toBeInTheDocument()
  })

  it('shows round tabs', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: makeApp(2) })
    renderPage()
    expect(await screen.findByRole('button', { name: /round 1/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /round 2/i })).toBeInTheDocument()
  })

  it('hides changes tab on round 1 (only one submission)', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: makeApp(1) })
    renderPage()
    await screen.findByRole('heading', { name: /original name/i })
    expect(screen.queryByText(/changes \(/i)).not.toBeInTheDocument()
  })

  it('shows changes tab on round 2+ and clicking shows before→after', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: makeApp(2) })
    renderPage()
    // By default latest (round 2) is selected
    const changesTab = await screen.findByText(/changes \(/i)
    fireEvent.click(changesTab)
    // "Original Name" should appear as old value (strikethrough)
    expect(screen.getByText('Original Name')).toBeInTheDocument()
    const updatedNames = screen.getAllByText('Updated Name')
    expect(updatedNames.length).toBeGreaterThanOrEqual(1)
  })

  it('renders FeedbackPanel', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: makeApp(1) })
    renderPage()
    expect(await screen.findByText(/officer feedback/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit feedback/i })).toBeInTheDocument()
  })
})
