import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ResubmissionPage from './ResubmissionPage'

vi.mock('../lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }))

import { api } from '../lib/api'

describe('ResubmissionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows feedback summary when feedback exists', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/submissions')) {
        return Promise.resolve({
          data: [{
            round_number: 1,
            submitted_at: '2026-04-27T00:00:00Z',
            form_data: {
              basic_details: { centre_name: 'Test', operator_company_name: 'Co', uen: '123', contact_person: 'A', contact_email: 'a@b.com', contact_phone: '123' },
              operations: { centre_address: 'Addr', type_of_service: 'Childcare', proposed_capacity: 10 },
            },
            documents: [],
            feedback_items: [],
          }],
        })
      }
      return Promise.resolve({
        data: {
          id: 'app-1',
          status: 'Pending Pre-Site Resubmission',
          current_round: 1,
          latest_submission: {
            form_data: {
              basic_details: { centre_name: 'Test', operator_company_name: 'Co', uen: '123', contact_person: 'A', contact_email: 'a@b.com', contact_phone: '123' },
              operations: { centre_address: 'Addr', type_of_service: 'Childcare', proposed_capacity: 10 },
            },
            documents: [],
          },
          latest_feedback: [
            { id: 'fb-1', target_type: 'field', section: 'basic_details', field_key: 'centre_name', document_id: null, comment: 'Please provide the registered name', created_by: 'bob' },
          ],
        },
      })
    })

    render(
      <MemoryRouter initialEntries={['/operator/applications/app-1/resubmit']}>
        <Routes>
          <Route path="/operator/applications/:id/resubmit" element={<ResubmissionPage />} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText('Officer Feedback')).toBeInTheDocument()
    expect(screen.getByText('Please provide the registered name')).toBeInTheDocument()
  })
})
