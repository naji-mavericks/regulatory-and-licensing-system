# Application Detail Page Redesign

**Date:** 2026-04-28  
**Scope:** `frontend/src/pages/ApplicationDetailPage.tsx`

## Problem

The current `ApplicationDetailPage` renders submitted form data as a raw `JSON.stringify` dump inside a `<pre>` block. Officer feedback is shown in a separate flat list with no visual connection to the fields it refers to.

## Design Decisions

- **Layout:** Single-scroll page — status header → alert banner → section cards → documents card
- **Field-level feedback:** Displayed inline, directly below the flagged field (amber border on field + amber left-border callout beneath it)
- **Section-level feedback** (where `field_key` is null): Displayed as a banner at the top of the affected section
- **Document feedback:** Same inline pattern as field feedback — shown below the flagged document row
- **Round history:** Not shown; latest round only. Round history is an audit concern outside UC1/UC2 scope.

## Page Structure

### Header
- Back link (`← Back to applications`)
- Centre name (from `form_data.basic_details.centre_name`) as `h1`
- Round number as subtitle (`Round {current_round}`)
- `StatusBadge` component (existing)

### Alert Banner
Shown only when `latest_feedback.length > 0`. Fixed copy: "Officer feedback received. Review the comments below and resubmit." with a direct link to the resubmit route. Uses the existing amber/warning colour pattern.

### Section Cards
One card per form section: **Basic Details**, **Operations**, **Declarations**.

Each card:
- Section heading
- If section has section-level feedback (a `FeedbackItem` where `target_type === "field"` and `field_key === null` and `section` matches): render a banner at the top of the card
- Fields rendered in a 2-column grid using human-readable labels from `FIELD_LABELS` (already defined in `ResubmissionPage.tsx` — extract to a shared location)
- Field value shown in a read-only styled box
- If a field is flagged (`FeedbackItem` where `field_key` matches): amber border on the value box + `⚑ flagged` tag on the label + inline feedback callout below
- `centre_address` and `compliance_confirmed` span full width

### Documents Card
One row per document type in order: `staff_qualification`, `fire_safety`, `floor_plan`, `insurance` (optional).

Each row:
- Document type label (human-readable) + filename
- AI status badge (`pass` = green, `fail` = red, not submitted = neutral dash)
- Insurance shows `(optional)` suffix
- If the document is flagged (`FeedbackItem` where `target_type === "document"` and `document_id` matches): amber border on row + inline feedback callout below

### No Feedback State
When `latest_feedback` is empty, no alert banner is shown and no fields are highlighted. The page is purely a read-only view of the submission.

## Data Mapping

### Feedback resolution logic

```
For each FeedbackItem:
  if target_type === "field" and field_key !== null
    → attach to the matching field_key within the section
  if target_type === "field" and field_key === null
    → attach as a section-level banner for the matching section
  if target_type === "document"
    → attach to the document whose id matches document_id
```

### Field labels
Move `FIELD_LABELS` and `SECTION_LABELS` from `ResubmissionPage.tsx` into a shared constants file (e.g. `src/lib/formLabels.ts`) so both pages use the same source of truth.

## Constants

```ts
// src/lib/formLabels.ts
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

## Visual Spec

- Flagged field border: `border-amber-400 bg-amber-50`
- Inline feedback callout: `bg-amber-100 border-l-2 border-amber-400 text-amber-900 text-xs px-2 py-1`
- Section-level feedback banner: `bg-amber-50 border border-amber-200 rounded text-amber-900 text-xs px-3 py-2`
- Alert banner (top of page): `bg-amber-50 border border-amber-200 rounded-lg` — existing pattern from current page
- Field value box (normal): `bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5 text-sm text-slate-700`
- Field value box (flagged): `bg-amber-50 border-2 border-amber-400 rounded-md px-3 py-1.5 text-sm`
- Document row (flagged): same amber treatment as field

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/pages/ApplicationDetailPage.tsx` | Full rewrite — replace `<pre>` dump with structured layout |
| `frontend/src/lib/formLabels.ts` | New file — shared field/section/doc labels and ordering |
| `frontend/src/pages/ResubmissionPage.tsx` | Import labels from `formLabels.ts` instead of local constants |

## Out of Scope

- Officer review UI (UC2 — separate feature)
- Round history / submission timeline
- Editable fields (that's the ResubmissionPage)
- Any backend changes
