import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatusBadge from './StatusBadge'

describe('StatusBadge', () => {
  it('renders the status text', () => {
    render(<StatusBadge status="Under Review" />)
    expect(screen.getByText('Under Review')).toBeInTheDocument()
  })

  it('applies blue classes for Under Review', () => {
    render(<StatusBadge status="Under Review" />)
    const badge = screen.getByText('Under Review')
    expect(badge.className).toContain('bg-blue-50')
    expect(badge.className).toContain('text-blue-700')
  })

  it('applies blue classes for Application Received', () => {
    render(<StatusBadge status="Application Received" />)
    const badge = screen.getByText('Application Received')
    expect(badge.className).toContain('bg-blue-50')
  })

  it('applies amber classes for Pending Pre-Site Resubmission', () => {
    render(<StatusBadge status="Pending Pre-Site Resubmission" />)
    const badge = screen.getByText('Pending Pre-Site Resubmission')
    expect(badge.className).toContain('bg-amber-50')
    expect(badge.className).toContain('text-amber-700')
  })

  it('applies purple classes for Pre-Site Resubmitted', () => {
    render(<StatusBadge status="Pre-Site Resubmitted" />)
    const badge = screen.getByText('Pre-Site Resubmitted')
    expect(badge.className).toContain('bg-purple-50')
    expect(badge.className).toContain('text-purple-700')
  })

  it('applies green classes for Approved', () => {
    render(<StatusBadge status="Approved" />)
    const badge = screen.getByText('Approved')
    expect(badge.className).toContain('bg-green-50')
    expect(badge.className).toContain('text-green-700')
  })

  it('applies red classes for Rejected', () => {
    render(<StatusBadge status="Rejected" />)
    const badge = screen.getByText('Rejected')
    expect(badge.className).toContain('bg-red-50')
    expect(badge.className).toContain('text-red-700')
  })

  it('applies grey classes for unknown status', () => {
    render(<StatusBadge status="Submitted" />)
    const badge = screen.getByText('Submitted')
    expect(badge.className).toContain('bg-slate-100')
    expect(badge.className).toContain('text-slate-600')
  })
})
