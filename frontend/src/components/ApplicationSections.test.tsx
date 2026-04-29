import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ApplicationSections from './ApplicationSections'

const FORM_DATA = {
  basic_details: {
    centre_name: 'Sunshine Childcare',
    operator_company_name: 'EduCare Pte Ltd',
    uen: '2024XXXXXX',
    contact_person: 'Jane Tan',
    contact_email: 'jane@educare.sg',
    contact_phone: '+65 9123 4567',
  },
  operations: {
    centre_address: '123 Jurong East St',
    type_of_service: 'Childcare',
    proposed_capacity: 50,
  },
  declarations: { compliance_confirmed: true },
}

const DOCUMENTS = [
  { id: 'doc-1', doc_type: 'staff_qualification', filename: 'staff.pdf', ai_status: 'pass' },
  { id: 'doc-2', doc_type: 'fire_safety', filename: 'fire.pdf', ai_status: 'pass' },
  { id: 'doc-3', doc_type: 'floor_plan', filename: 'plan.pdf', ai_status: 'pass' },
]

describe('ApplicationSections', () => {
  it('renders field labels and values', () => {
    render(<ApplicationSections formData={FORM_DATA} documents={DOCUMENTS} />)
    expect(screen.getByText('Centre Name')).toBeInTheDocument()
    expect(screen.getByText('Sunshine Childcare')).toBeInTheDocument()
    expect(screen.getByText('UEN')).toBeInTheDocument()
    expect(screen.getByText('2024XXXXXX')).toBeInTheDocument()
  })

  it('renders document rows', () => {
    render(<ApplicationSections formData={FORM_DATA} documents={DOCUMENTS} />)
    expect(screen.getByText('Staff Qualification Certificate(s)')).toBeInTheDocument()
    expect(screen.getByText('Fire Safety Certificate')).toBeInTheDocument()
  })

  it('shows flagged indicator on field with feedback', () => {
    render(
      <ApplicationSections
        formData={FORM_DATA}
        documents={DOCUMENTS}
        feedbackByField={{ uen: [{ id: 'f-1', target_type: 'field', section: 'basic_details', field_key: 'uen', document_id: null, comment: 'Fix UEN', created_by: 'bob' }] }}
      />
    )
    expect(screen.getByText(/flagged/)).toBeInTheDocument()
    expect(screen.getByText('Fix UEN')).toBeInTheDocument()
  })

  it('shows changed badge when field differs from previous round', () => {
    const prevFormData = {
      ...FORM_DATA,
      basic_details: { ...FORM_DATA.basic_details, centre_name: 'Old Name' },
    }
    render(
      <ApplicationSections
        formData={FORM_DATA}
        documents={DOCUMENTS}
        previousFormData={prevFormData}
        previousDocuments={DOCUMENTS}
      />
    )
    expect(screen.getByText('changed')).toBeInTheDocument()
  })

  it('does not show changed badge when no previous data provided', () => {
    render(<ApplicationSections formData={FORM_DATA} documents={DOCUMENTS} />)
    expect(screen.queryByText('changed')).not.toBeInTheDocument()
  })
})
