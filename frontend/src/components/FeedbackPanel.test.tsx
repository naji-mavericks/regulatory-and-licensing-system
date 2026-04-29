import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import FeedbackPanel from './FeedbackPanel'

vi.mock('../lib/api', () => ({ api: { post: vi.fn() } }))
import { api } from '../lib/api'

const DOCS = [
  { id: 'doc-1', doc_type: 'staff_qualification', filename: 'staff.pdf', ai_status: 'pass' },
]

const renderPanel = (onSuccess = vi.fn()) =>
  render(
    <MemoryRouter>
      <FeedbackPanel
        applicationId="app-1"
        currentStatus="Application Received"
        documents={DOCS}
        onSuccess={onSuccess}
      />
    </MemoryRouter>
  )

describe('FeedbackPanel', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('submit button is disabled when comment is empty', () => {
    renderPanel()
    expect(screen.getByRole('button', { name: /submit feedback/i })).toBeDisabled()
  })

  it('submit button is disabled when status not selected even with comment', () => {
    renderPanel()
    fireEvent.change(screen.getByPlaceholderText(/enter feedback comment/i), {
      target: { value: 'Fix this field' },
    })
    expect(screen.getByRole('button', { name: /submit feedback/i })).toBeDisabled()
  })

  it('submit button is enabled when comment and status both provided', async () => {
    renderPanel()
    fireEvent.change(screen.getByPlaceholderText(/enter feedback comment/i), {
      target: { value: 'Fix this field' },
    })
    const comboboxes = screen.getAllByRole('combobox')
    fireEvent.change(comboboxes[comboboxes.length - 1], { target: { value: 'Under Review' } })
    expect(screen.getByRole('button', { name: /submit feedback/i })).not.toBeDisabled()
  })

  it('calls API with correct payload and calls onSuccess', async () => {
    const onSuccess = vi.fn()
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { application_id: 'app-1', status: 'Under Review', feedback_items: [] },
    })
    renderPanel(onSuccess)

    fireEvent.change(screen.getByPlaceholderText(/enter feedback comment/i), {
      target: { value: 'Fix the UEN field' },
    })
    const comboboxes = screen.getAllByRole('combobox')
    fireEvent.change(comboboxes[comboboxes.length - 1], { target: { value: 'Under Review' } })
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/applications/app-1/feedback',
        expect.objectContaining({ new_status: 'Under Review' })
      )
      expect(onSuccess).toHaveBeenCalled()
    })
  })

  it('preserves draft and shows error on API failure', async () => {
    vi.mocked(api.post).mockRejectedValueOnce({
      response: { data: { detail: 'Invalid status transition' } },
    })
    renderPanel()

    fireEvent.change(screen.getByPlaceholderText(/enter feedback comment/i), {
      target: { value: 'My comment' },
    })
    const comboboxes = screen.getAllByRole('combobox')
    fireEvent.change(comboboxes[comboboxes.length - 1], { target: { value: 'Under Review' } })
    fireEvent.click(screen.getByRole('button', { name: /submit feedback/i }))

    expect(await screen.findByText(/invalid status transition/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/enter feedback comment/i)).toHaveValue('My comment')
  })
})
