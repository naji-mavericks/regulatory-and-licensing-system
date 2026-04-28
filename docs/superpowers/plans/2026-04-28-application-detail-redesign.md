# Application Detail Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the raw JSON dump in `ApplicationDetailPage` with a structured, section-by-section read-only view that shows officer feedback inline — directly below each flagged field or document, or as a banner at the top of a flagged section.

**Architecture:** Extract shared label constants into `src/lib/formLabels.ts`, rewrite `ApplicationDetailPage.tsx` to render section cards with inline feedback, and update `ResubmissionPage.tsx` to import from the shared constants instead of its local copies.

**Tech Stack:** React 19, TypeScript, Tailwind v4, Vitest + Testing Library, React Router v7

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `frontend/src/lib/formLabels.ts` | **Create** | Shared field labels, section labels, doc type labels, ordering constants |
| `frontend/src/pages/ApplicationDetailPage.tsx` | **Rewrite** | Structured read-only view with inline officer feedback |
| `frontend/src/pages/ApplicationDetailPage.test.tsx` | **Rewrite** | Tests covering all feedback scenarios |
| `frontend/src/pages/ResubmissionPage.tsx` | **Modify** | Remove local `FIELD_LABELS`/`SECTION_LABELS`, import from `formLabels.ts` |

---

## Task 1: Create shared form labels constants

**Files:**
- Create: `frontend/src/lib/formLabels.ts`

- [ ] **Step 1: Create the file**

```ts
// frontend/src/lib/formLabels.ts
export const FIELD_LABELS: Record<string, string> = {
  centre_name: 'Centre Name',
  operator_company_name: 'Operator / Company Name',
  uen: 'UEN',
  contact_person: 'Contact Person',
  contact_email: 'Contact Email',
  contact_phone: 'Contact Phone',
  centre_address: 'Centre Address',
  type_of_service: 'Type of Service',
  proposed_capacity: 'Proposed Capacity',
  compliance_confirmed: 'Compliance Declaration',
}

export const SECTION_LABELS: Record<string, string> = {
  basic_details: 'Basic Details',
  operations: 'Operations',
  documents: 'Documents',
  declarations: 'Declarations',
}

export const DOC_TYPE_LABELS: Record<string, string> = {
  staff_qualification: 'Staff Qualification Certificate(s)',
  fire_safety: 'Fire Safety Certificate',
  floor_plan: 'Floor Plan of Premises',
  insurance: 'Insurance Certificate',
}

export const SECTION_ORDER = ['basic_details', 'operations', 'declarations']
export const DOC_TYPE_ORDER = ['staff_qualification', 'fire_safety', 'floor_plan', 'insurance']
export const OPTIONAL_DOC_TYPES = new Set(['insurance'])
```

- [ ] **Step 2: Commit**

```bash
cd frontend
git add src/lib/formLabels.ts
git commit -m "feat: add shared form label constants"
```

---

## Task 2: Update ResubmissionPage to use shared labels

**Files:**
- Modify: `frontend/src/pages/ResubmissionPage.tsx`

- [ ] **Step 1: Run existing ResubmissionPage tests to establish baseline**

```bash
cd frontend
npx vitest run src/pages/ResubmissionPage.test.tsx
```

Expected: all tests pass.

- [ ] **Step 2: Replace local constants with imports**

In `frontend/src/pages/ResubmissionPage.tsx`, remove the local `FIELD_LABELS` and `SECTION_LABELS` constant blocks (lines 33–50) and add an import at the top of the file:

```ts
import { FIELD_LABELS, SECTION_LABELS } from '../lib/formLabels'
```

The removed blocks look like:

```ts
// DELETE these lines:
const FIELD_LABELS: Record<string, string> = {
  centre_name: 'Centre Name',
  operator_company_name: 'Operator / Company Name',
  uen: 'UEN',
  contact_person: 'Contact Person',
  contact_email: 'Contact Email',
  contact_phone: 'Contact Phone',
  centre_address: 'Centre Address',
  type_of_service: 'Type of Service',
  proposed_capacity: 'Proposed Capacity',
}

const SECTION_LABELS: Record<string, string> = {
  basic_details: 'Basic Details',
  operations: 'Operations',
  documents: 'Documents',
  declarations: 'Declarations',
}
```

- [ ] **Step 3: Run tests to confirm nothing broke**

```bash
cd frontend
npx vitest run src/pages/ResubmissionPage.test.tsx
```

Expected: all tests still pass.

- [ ] **Step 4: Commit**

```bash
git add src/pages/ResubmissionPage.tsx
git commit -m "refactor: import form labels from shared constants"
```

---

## Task 3: Write failing tests for the new ApplicationDetailPage

**Files:**
- Rewrite: `frontend/src/pages/ApplicationDetailPage.test.tsx`

- [ ] **Step 1: Replace the test file with comprehensive tests**

```tsx
// frontend/src/pages/ApplicationDetailPage.test.tsx
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
```

- [ ] **Step 2: Run tests and confirm they all fail**

```bash
cd frontend
npx vitest run src/pages/ApplicationDetailPage.test.tsx
```

Expected: most tests fail — the component still renders a `<pre>` block, not structured fields or inline feedback.

- [ ] **Step 3: Commit the failing tests**

```bash
git add src/pages/ApplicationDetailPage.test.tsx
git commit -m "test: add ApplicationDetailPage structured view tests (failing)"
```

---

## Task 4: Implement the new ApplicationDetailPage

**Files:**
- Rewrite: `frontend/src/pages/ApplicationDetailPage.tsx`

- [ ] **Step 1: Rewrite the component**

```tsx
// frontend/src/pages/ApplicationDetailPage.tsx
import React from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/api'
import StatusBadge from '../components/StatusBadge'
import {
  FIELD_LABELS,
  SECTION_LABELS,
  DOC_TYPE_LABELS,
  SECTION_ORDER,
  DOC_TYPE_ORDER,
  OPTIONAL_DOC_TYPES,
} from '../lib/formLabels'

interface FeedbackItem {
  id: string
  target_type: string
  section: string
  field_key: string | null
  document_id: string | null
  comment: string
  created_by: string
}

interface Document {
  id: string
  doc_type: string
  filename: string
  ai_status: string
}

interface ApplicationDetail {
  id: string
  status: string
  current_round: number
  latest_submission: {
    form_data: Record<string, Record<string, unknown>>
    documents: Document[]
  } | null
  latest_feedback: FeedbackItem[]
}

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [app, setApp] = React.useState<ApplicationDetail | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!id) return
    api.get(`/applications/${id}`)
      .then(res => setApp(res.data))
      .catch(() => setError('Failed to load application.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <p className="p-6">Loading...</p>
  if (error) return <p className="p-6 text-red-500">{error}</p>
  if (!app) return <p className="p-6">Application not found.</p>

  const hasFeedback = app.latest_feedback.length > 0
  const needsResubmission = app.status === 'Pending Pre-Site Resubmission'
  const formData = app.latest_submission?.form_data ?? {}
  const documents = app.latest_submission?.documents ?? []

  // Index feedback by field key and by document id
  const fieldFeedback: Record<string, FeedbackItem[]> = {}
  const sectionFeedback: Record<string, FeedbackItem[]> = {}
  const docFeedback: Record<string, FeedbackItem[]> = {}

  for (const item of app.latest_feedback) {
    if (item.target_type === 'document' && item.document_id) {
      docFeedback[item.document_id] = [...(docFeedback[item.document_id] ?? []), item]
    } else if (item.target_type === 'field' && item.field_key) {
      fieldFeedback[item.field_key] = [...(fieldFeedback[item.field_key] ?? []), item]
    } else if (item.target_type === 'field' && !item.field_key) {
      sectionFeedback[item.section] = [...(sectionFeedback[item.section] ?? []), item]
    }
  }

  const centreName = formData.basic_details?.centre_name as string | undefined

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Header */}
      <Link to="/operator/applications" className="text-sm text-blue-600 underline mb-2 block">
        &larr; Back to applications
      </Link>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{centreName || 'Application'}</h1>
          <p className="text-sm text-slate-500 mt-1">Round {app.current_round}</p>
        </div>
        <StatusBadge status={app.status} />
      </div>

      {/* Alert banner */}
      {hasFeedback && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-center justify-between">
          <p className="text-sm font-medium text-amber-800">
            Officer feedback received. Review the comments below and resubmit.
          </p>
          {needsResubmission && (
            <Link
              to={`/operator/applications/${app.id}/resubmit`}
              className="text-sm text-blue-600 underline ml-4 whitespace-nowrap"
            >
              Resubmit Application
            </Link>
          )}
        </div>
      )}

      {/* Section cards */}
      {app.latest_submission && SECTION_ORDER.map(section => {
        const fields = formData[section]
        if (!fields) return null
        const sectionItems = sectionFeedback[section] ?? []
        const sectionLabel = SECTION_LABELS[section] ?? section

        return (
          <div key={section} className="border border-slate-200 rounded-lg p-4 mb-4">
            <h2 className="font-semibold text-sm mb-3">{sectionLabel}</h2>

            {/* Section-level feedback banner */}
            {sectionItems.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">
                {sectionItems.map(f => (
                  <p key={f.id} className="text-xs text-amber-900">{f.comment}</p>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {Object.entries(fields).map(([key, value]) => {
                const isFullWidth = key === 'centre_address' || key === 'compliance_confirmed'
                const flaggedItems = fieldFeedback[key] ?? []
                const isFlagged = flaggedItems.length > 0
                const label = FIELD_LABELS[key] ?? key

                const displayValue = key === 'compliance_confirmed'
                  ? (value ? '✓ I confirm all information is accurate' : '✗ Not confirmed')
                  : String(value ?? '')

                return (
                  <div
                    key={key}
                    className={`flex flex-col gap-1 ${isFullWidth ? 'col-span-2' : ''}`}
                  >
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      {label}
                      {isFlagged && <span className="text-amber-600 font-medium">⚑ flagged</span>}
                    </span>
                    <div className={`rounded-md px-3 py-1.5 text-sm ${
                      isFlagged
                        ? 'bg-amber-50 border-2 border-amber-400 text-slate-700'
                        : 'bg-slate-50 border border-slate-200 text-slate-700'
                    }`}>
                      {displayValue}
                    </div>
                    {flaggedItems.map(f => (
                      <div
                        key={f.id}
                        className="bg-amber-100 border-l-2 border-amber-400 rounded text-amber-900 text-xs px-2 py-1"
                      >
                        {f.comment}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Documents card */}
      {app.latest_submission && (
        <div className="border border-slate-200 rounded-lg p-4 mb-4">
          <h2 className="font-semibold text-sm mb-3">Documents</h2>
          <div className="flex flex-col gap-2">
            {DOC_TYPE_ORDER.map(docType => {
              const doc = documents.find(d => d.doc_type === docType)
              const isOptional = OPTIONAL_DOC_TYPES.has(docType)
              const flaggedItems = doc ? (docFeedback[doc.id] ?? []) : []
              const isFlagged = flaggedItems.length > 0
              const label = DOC_TYPE_LABELS[docType] ?? docType

              return (
                <div key={docType}>
                  <div className={`rounded-md border px-3 py-2 ${
                    isFlagged
                      ? 'bg-amber-50 border-2 border-amber-400'
                      : 'bg-slate-50 border-slate-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium">
                          {label}
                          {isOptional && <span className="text-xs text-slate-400 ml-1">(optional)</span>}
                          {isFlagged && <span className="text-xs text-amber-600 font-medium ml-1">⚑ flagged</span>}
                        </span>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {doc ? doc.filename : 'Not submitted'}
                        </p>
                      </div>
                      {doc ? (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          doc.ai_status === 'pass'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {doc.ai_status}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </div>
                  </div>
                  {flaggedItems.map(f => (
                    <div
                      key={f.id}
                      className="bg-amber-100 border-l-2 border-amber-400 rounded text-amber-900 text-xs px-2 py-1 mt-1"
                    >
                      {f.comment}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run tests**

```bash
cd frontend
npx vitest run src/pages/ApplicationDetailPage.test.tsx
```

Expected: all tests pass.

- [ ] **Step 3: Run the full frontend test suite to check for regressions**

```bash
cd frontend
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Run lint**

```bash
cd frontend
npm run lint
```

Expected: no errors, no warnings.

- [ ] **Step 5: Commit**

```bash
git add src/pages/ApplicationDetailPage.tsx
git commit -m "feat: redesign ApplicationDetailPage with structured fields and inline feedback"
```

---

## Task 5: Smoke test in the browser

- [ ] **Step 1: Start the dev server (docker db must be running)**

```bash
# In one terminal — start the database
docker compose up -d db

# In another terminal — start the backend
cd backend && uv run uvicorn app.main:app --reload

# In another terminal — start the frontend
cd frontend && npm run dev
```

- [ ] **Step 2: Seed the database**

```bash
cd backend
uv run python seed.py
```

Expected output: `Seed complete.` (or `Users already exist, skipping.` if already seeded)

- [ ] **Step 3: Log in as alice (operator) and open the seeded application**

1. Open `http://localhost:5173`
2. Log in: username `alice`, role `operator`
3. Click into the application in the list
4. Verify:
   - Centre name appears as the page heading
   - Round number shown below the heading
   - Status badge visible
   - All sections (Basic Details, Operations, Declarations) rendered as cards with field labels and values
   - Documents section shows all four doc types with filenames and AI badges
   - Insurance shows "Not submitted" if not uploaded
   - Alert banner is visible (alice's app has feedback from bob per seed script)
   - The UEN field or whichever field bob flagged shows the amber border and inline feedback callout
   - "Resubmit Application" link is visible (status is "Pending Pre-Site Resubmission")

- [ ] **Step 4: Log in as charlie (operator, no feedback app) and verify clean state**

1. Log out, log in as `charlie`, role `operator`
2. If charlie has no applications, the list is empty — that's fine
3. If charlie has an application with no feedback, open it and verify no alert banner appears and no fields are highlighted

- [ ] **Step 5: Final commit if any visual tweaks were made**

```bash
git add -p  # stage only intentional changes
git commit -m "fix: visual tweaks from smoke test"
```
