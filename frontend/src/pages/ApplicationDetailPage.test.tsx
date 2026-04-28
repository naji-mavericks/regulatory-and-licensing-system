import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ApplicationDetailPage from './ApplicationDetailPage'

vi.mock('../lib/api', () => ({ api: { get: vi.fn() } }))

import { api } from '../lib/api'

const BASE_APP = {
  id: 'app-1',
  status: 'Submitted',
  current_round: 1,
  latest_submission: {
    form_data: {
      basic_details: {
        centre_name: 'Test Centre',
        operator_company_name: 'Test Co',
        uen: '202312345A',
        contact_person: 'Alice',
        contact_email: 'alice@test.com',
        contact_phone: '91234567',
      },
      operations: {
        centre_address: 'Blk 1 Test St',
        type_of_service: 'Childcare',
        proposed_capacity: 30,
      },
      declarations: {
        compliance_confirmed: true,
      },
    },
    documents: [
      { id: 'doc-1', doc_type: 'staff_qualification', filename: 'staff.pdf', ai_status: 'pass' },
      { id: 'doc-2', doc_type: 'fire_safety', filename: 'fire.pdf', ai_status: 'pass' },
      { id: 'doc-3', doc_type: 'floor_plan', filename: 'plan.pdf', ai_status: 'pass' },
    ],
  },
  latest_feedback: [],
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/operator/applications/app-1']}>
      <Routes>
        <Route path="/operator/applications/:id" element={<ApplicationDetailPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('ApplicationDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.get).mockResolvedValue({ data: BASE_APP })
  })

  it('shows centre name as heading', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: 'Test Centre' })).toBeInTheDocument()
  })

  it('shows status badge', async () => {
    renderPage()
    expect(await screen.findByText('Submitted')).toBeInTheDocument()
  })

  it('shows round number', async () => {
    renderPage()
    expect(await screen.findByText(/Round 1/)).toBeInTheDocument()
  })

  it('renders field labels and values for all sections', async () => {
    renderPage()
    expect(await screen.findByText('Centre Name')).toBeInTheDocument()
    expect(screen.getByText('Test Centre')).toBeInTheDocument()
    expect(screen.getByText('UEN')).toBeInTheDocument()
    expect(screen.getByText('202312345A')).toBeInTheDocument()
    expect(screen.getByText('Centre Address')).toBeInTheDocument()
    expect(screen.getByText('Blk 1 Test St')).toBeInTheDocument()
    expect(screen.getByText('Proposed Capacity')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
  })

  it('renders document rows with human-readable labels', async () => {
    renderPage()
    expect(await screen.findByText('Staff Qualification Certificate(s)')).toBeInTheDocument()
    expect(screen.getByText('Fire Safety Certificate')).toBeInTheDocument()
    expect(screen.getByText('Floor Plan of Premises')).toBeInTheDocument()
  })

  it('shows insurance row as not submitted when absent', async () => {
    renderPage()
    expect(await screen.findByText('Insurance Certificate')).toBeInTheDocument()
    expect(screen.getByText('Not submitted')).toBeInTheDocument()
  })

  it('does not show alert banner when there is no feedback', async () => {
    renderPage()
    await screen.findByText('Test Centre')
    expect(screen.queryByText(/Officer feedback received/)).not.toBeInTheDocument()
  })

  it('shows alert banner when feedback exists', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        ...BASE_APP,
        latest_feedback: [
          { id: 'f-1', target_type: 'field', section: 'basic_details', field_key: 'uen', document_id: null, comment: 'UEN is wrong', created_by: 'bob' },
        ],
      },
    })
    renderPage()
    expect(await screen.findByText(/Officer feedback received/)).toBeInTheDocument()
  })

  it('shows inline feedback below flagged field', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        ...BASE_APP,
        latest_feedback: [
          { id: 'f-1', target_type: 'field', section: 'basic_details', field_key: 'uen', document_id: null, comment: 'UEN is wrong', created_by: 'bob' },
        ],
      },
    })
    renderPage()
    expect(await screen.findByText('UEN is wrong')).toBeInTheDocument()
  })

  it('shows section-level feedback as banner at top of section when field_key is null', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        ...BASE_APP,
        latest_feedback: [
          { id: 'f-2', target_type: 'field', section: 'operations', field_key: null, document_id: null, comment: 'Operations details need review', created_by: 'bob' },
        ],
      },
    })
    renderPage()
    expect(await screen.findByText('Operations details need review')).toBeInTheDocument()
  })

  it('shows inline feedback below flagged document', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        ...BASE_APP,
        latest_feedback: [
          { id: 'f-3', target_type: 'document', section: 'documents', field_key: null, document_id: 'doc-2', comment: 'Certificate is expired', created_by: 'bob' },
        ],
      },
    })
    renderPage()
    expect(await screen.findByText('Certificate is expired')).toBeInTheDocument()
  })

  it('shows resubmit link only when status is Pending Pre-Site Resubmission', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        ...BASE_APP,
        status: 'Pending Pre-Site Resubmission',
        latest_feedback: [
          { id: 'f-1', target_type: 'field', section: 'basic_details', field_key: 'uen', document_id: null, comment: 'Fix UEN', created_by: 'bob' },
        ],
      },
    })
    renderPage()
    expect(await screen.findByRole('link', { name: /Resubmit Application/i })).toBeInTheDocument()
  })

  it('does not show resubmit link when status is Submitted', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        ...BASE_APP,
        status: 'Submitted',
        latest_feedback: [
          { id: 'f-1', target_type: 'field', section: 'basic_details', field_key: 'uen', document_id: null, comment: 'Fix UEN', created_by: 'bob' },
        ],
      },
    })
    renderPage()
    await screen.findByText('Test Centre')
    expect(screen.queryByRole('link', { name: /Resubmit Application/i })).not.toBeInTheDocument()
  })
})
