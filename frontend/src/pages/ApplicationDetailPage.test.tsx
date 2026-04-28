import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ApplicationDetailPage from './ApplicationDetailPage'

vi.mock('../lib/api', () => ({ api: { get: vi.fn() } }))

import { api } from '../lib/api'

describe('ApplicationDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows status and centre name', async () => {
    vi.mocked(api.get).mockImplementation((url: string) => {
      if (url.includes('/submissions')) return Promise.resolve({ data: [] })
      return Promise.resolve({
        data: {
          id: 'app-1',
          status: 'Submitted',
          current_round: 1,
          latest_submission: {
            form_data: {
              basic_details: { centre_name: 'Test Centre', operator_company_name: 'Co', uen: '123', contact_person: 'A', contact_email: 'a@b.com', contact_phone: '123' },
              operations: { centre_address: 'Addr', type_of_service: 'Childcare', proposed_capacity: 10 },
              declarations: { compliance_confirmed: true },
            },
            documents: [],
          },
          latest_feedback: [],
        },
      })
    })

    render(
      <MemoryRouter initialEntries={['/operator/applications/app-1']}>
        <Routes>
          <Route path="/operator/applications/:id" element={<ApplicationDetailPage />} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText('Submitted')).toBeInTheDocument()
    expect(screen.getByText('Test Centre')).toBeInTheDocument()
  })
})
