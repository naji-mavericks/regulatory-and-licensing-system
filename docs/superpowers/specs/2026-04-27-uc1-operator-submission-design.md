# UC1: Operator Application Submission & Resubmission — Design

**Date:** 2026-04-27
**Scope:** Use Case 1 only (UC2 for officer review/feedback follows)
**Status:** Approved

## Overview

Implement the full operator workflow: fill a multi-section childcare application form, upload documents with real-time AI verification, submit, receive officer feedback, and resubmit only the flagged sections. Multiple rounds of feedback and resubmission are supported with a full audit trail.

## Data Model

Four tables. The `submissions` table is the versioning mechanism — each round creates a new row with a full `form_data` snapshot, so nothing is ever overwritten.

### `applications`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| operator_id | VARCHAR | JWT username (no FK to users table) |
| status | ENUM | Internal status (`Application Received`, `Under Review`, etc.) |
| current_round | INTEGER | Default 1 |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### `submissions`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| application_id | FK → applications | |
| round_number | INTEGER | |
| form_data | JSONB | Full snapshot of all 4 sections for this round |
| submitted_at | TIMESTAMP | |

### `documents`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| application_id | FK → applications | Always set, even pre-submit |
| submission_id | FK → submissions | NULLable; set when included in a submission round |
| doc_type | ENUM | `staff_qualification`, `fire_safety`, `floor_plan`, `insurance` |
| filename | VARCHAR | Original filename |
| file_path | VARCHAR | Local storage path |
| ai_status | ENUM | `pending`, `pass`, `fail`, `error` |
| ai_details | JSONB | Stub response payload |
| uploaded_at | TIMESTAMP | |

Pre-submit uploads have `application_id` set and `submission_id = NULL`. On submission, `submission_id` is updated to link to the new submission row. Rejected/replaced documents stay with `submission_id = NULL` and remain queryable by `application_id`.

### `feedback_items`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| submission_id | FK → submissions | Which round was reviewed |
| target_type | ENUM | `field`, `document` |
| section | ENUM | `basic_details`, `operations`, `documents`, `declarations` |
| field_key | ENUM NULLABLE | `centre_name`, `operator_company_name`, `uen`, `contact_person`, `contact_email`, `contact_phone`, `centre_address`, `type_of_service`, `proposed_capacity` |
| document_id | FK → documents NULLABLE | Set when `target_type = document` |
| comment | TEXT | |
| created_by | VARCHAR | Officer username |
| created_at | TIMESTAMP | |

When `target_type = field` and `field_key IS NULL`, the feedback applies to the whole section. When `field_key` is set, it targets a specific field within that section.

## API Endpoints

All endpoints require Bearer token with `role: "operator"` via the existing `require_operator` dependency.

### `POST /documents/upload`
Upload a document for AI verification before submitting the application.

- **Request:** multipart/form-data — `file` + `doc_type`
- **AI stub runs immediately:** pass/fail by document type keyword in filename. Files containing `fail-{doc_type}` (e.g. `fail-fire_safety.pdf`) fail. All others pass.
- **Storage:** File saved to local uploads directory. Row inserted in `documents` with `submission_id = NULL`, `application_id = NULL` (set after application creation, see below).
- **Response 201:** `{ id, doc_type, filename, ai_status, ai_details }`

On the first upload for an application, an application row is created with status `Application Received`. Subsequent uploads for the same session reference the same application. The session/app association is managed by returning an `application_id` on the first upload response, which the frontend sends with subsequent uploads.

### `POST /applications`
Submit the completed application.

- **Request:** JSON — `{ application_id, form_data, document_ids: [uuid, ...] }`
- Validates that all required doc_types are present (staff_qualification, fire_safety, floor_plan), form_data has all required fields, and declaration is checked.
- Creates the first submission row (round 1) with the form_data snapshot. Updates referenced document rows to set `submission_id`. Transitions application status to `Application Received`.
- **Response 201:** `{ id, status: "Submitted", round_number: 1, form_data, documents }` — status uses operator-facing label.

### `GET /applications`
List operator's own applications.

- **Response 200:** `[{ id, status: <operator_label>, centre_name, type_of_service, current_round, updated_at }]`
- Filtered by `operator_id` from JWT. Sorted by `updated_at` descending.
- Returns summary fields only (no full form_data) — use `GET /applications/{id}` for detail.

### `GET /applications/{id}`
View application current state.

- **Response 200:** `{ id, status: <operator_label>, current_round, latest_submission: { form_data, documents[] }, latest_feedback: feedback_items[] }`
- Status is always the operator-mapped label (e.g. "Submitted" not "Application Received").
- Operator sees only their own applications (filtered by `operator_id` from JWT).

### `POST /applications/{id}/resubmit`
Create a new submission round with updated fields and/or documents.

- **Request:** JSON — `{ form_data: { <partial — only flagged fields> }, document_ids: [uuid, ...] }`
- Creates a new submission row (round N+1). Merges the partial form_data with the previous round's form_data snapshot (previous round's values for unflagged fields, new values for flagged fields). Documents from the previous round are carried forward; flagged documents are replaced by the new uploads.
- Transitions status to `Pre-Site Resubmitted`.
- **Response 201:** `{ id, status: "Pre-Site Resubmitted", round_number: N+1, ... }`

### `GET /applications/{id}/submissions`
Get full submission history.

- **Response 200:** `[{ round_number, submitted_at, form_data, documents[], feedback_items[] }]`
- Ordered by round_number ascending. Resubmission UI uses this to show previous rounds and officer comments.

## AI Verification Stub

AI runs synchronously on `POST /documents/upload`. Stub behavior:

- Filename contains `fail-{doc_type}` → `ai_status: "fail"`, `ai_details: { reason: "Document appears invalid/expired" }`
- All other filenames → `ai_status: "pass"`, `ai_details: { confidence: 0.95 }`

## Status Mapping (Operator View)

API responses always return operator-facing labels:

| Internal Status | Operator Label |
|-----------------|----------------|
| Application Received | Submitted |
| Under Review | Under Review |
| Pending Pre-Site Resubmission | Pending Pre-Site Resubmission |
| Pre-Site Resubmitted | Pre-Site Resubmitted |

Full 12-state mapping in `USE_CASES.md`. Only the UC1-relevant statuses are listed above.

## Frontend

### Routes
| Path | Page | Notes |
|------|------|-------|
| `/` | LoginPage | Existing |
| `/login` | LoginPage | Existing |
| `/operator/apply` | SubmitApplicationPage | New — multi-section form + doc uploads |
| `/operator/applications` | ApplicationListPage | New — summary cards of operator's applications |
| `/operator/applications/:id` | ApplicationDetailPage | New — status + submission history |
| `/operator/applications/:id/resubmit` | ResubmissionPage | New — feedback + flagged fields |

### Component Tree — SubmitApplicationPage
```
SubmitApplicationPage
├── ProgressIndicator         — derived: form fields + docs complete
├── BasicDetailsSection       — RHF fields (centre_name, operator_company_name, etc.)
├── OperationsSection         — RHF fields (centre_address, type_of_service, proposed_capacity)
├── DocumentUploadSection     — 3-4 DocumentUploader instances
│   └── DocumentUploader      — drag-and-drop, AI status badge per doc
├── DeclarationsSection       — checkbox
└── SubmitButton              — disabled until all required fields + docs present
```

### Component Tree — ResubmissionPage
```
ResubmissionPage
├── FeedbackSummary           — officer comments displayed prominently at top
├── BasicDetailsSection       — locked unless flagged by feedback_item
├── OperationsSection         — locked unless flagged
├── DocumentUploadSection     — only flagged docs show re-upload option
├── PreviousSubmissionView    — collapsible, shows previous round data
└── ResubmitButton
```

Sections are locked/unlocked based on `feedback_items` from the latest reviewed submission: a section is flagged (editable) if any `feedback_item` targets it. A field within a section is flagged if a `feedback_item` targets that specific `field_key`.

### State Management
No global state library. Each page uses React Hook Form (`useForm` + `zodResolver`) for form state and `useState` for document upload lists. Progress is derived from form completion + required document count.

### Progress Indicator
- Section complete: all required fields non-empty
- Documents complete: 3 required doc_types uploaded with AI status `pass`
- Declarations: checkbox checked
- Submit enabled: all sections + docs + declaration complete

## Key Design Decisions

1. **submissions.form_data is a full snapshot** — each round saves all fields, not just changes. Simple to query ("what did round 2 look like?").
2. **documents.application_id is always set** — rejected pre-submit documents remain queryable. `submission_id` is NULL until included in a submission.
3. **AI runs pre-submit** — operator sees pass/fail per document while still filling out the form, can re-upload before submitting.
4. **Resubmit merges partial form_data** — operator sends only flagged fields; backend merges with previous round's data.
5. **field_key and doc_type are ENUMs** — prevents misspelled field references in feedback, DB-level validation.
6. **Status labels in API responses are always operator-mapped** — UI never has to translate internal statuses.

## GitHub Issues

The existing issues (#7–#14) remain the implementation tasks. Updates needed:

| Issue | Change |
|-------|--------|
| #7 (Application schema & DB migration) | Refined with ENUMs for doc_type, field_key, target_type, section; documents has application_id + nullable submission_id |
| #8 (Submit application API) | Split: POST /documents/upload (pre-submit AI) + POST /applications (JSON with document_ids) |
| #9 (Get application API) | Return operator-mapped status label, latest submission + feedback |
| #10 (Submit application UI — form) | DocumentUploader with real-time AI badge per doc, progress indicator |
| #12 (Resubmission API) | Merge partial form_data, carry forward unflagged docs, preserve history |
| #14 (Resubmission UI) | Sections locked unless flagged by feedback_item; FeedbackSummary at top |

New issues to create:

| ID | Title | Labels |
|----|-------|--------|
| UC1-0a | Operator application list API | `uc1-submission` |
| UC1-0b | Operator application list UI | `uc1-submission` |
