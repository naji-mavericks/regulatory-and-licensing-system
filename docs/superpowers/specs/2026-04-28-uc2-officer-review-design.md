# UC2: Officer Application Review & Feedback — Design

**Date:** 2026-04-28
**Scope:** Use Case 2 — officer application list, detail, feedback, status transitions, notification stub. Also covers auth changes that affect UC1.
**Status:** Approved

---

## Overview

Officers need to review operator submissions, surface AI flags and resubmission diffs, write section-targeted feedback, and transition application status. UC2 builds entirely on the data model established in UC1 — no new tables are required.

The implementation adds:
- Role-branching to existing application endpoints
- Two new officer-only endpoints (feedback, status transition)
- A state machine and notification stub as isolated service modules
- `OfficerLayout` sidebar shell + three new frontend pages behind `/officer/` routes
- A shared `ApplicationSections` read-only display component (extracts inline rendering from the already-redesigned `ApplicationDetailPage.tsx`)
- Auth changes: role derived from DB, dummy password field on login

---

## Auth Changes (modifications to UC1)

### Backend — `POST /auth/login`

**Before:** accepted `{ username, role }`, trusted the caller-supplied role.  
**After:** accepts `{ username }` only. Handler looks up the user by username in the `users` table. Returns `401` if not found. JWT `role` claim is set from `user.role` in the DB. Response body returns `{ token, role }` so the frontend can redirect without decoding the JWT.

This closes the gap where any caller could request an officer token by supplying `role: "officer"`.

### Frontend — `LoginPage`

- Remove the role dropdown.
- Add a `password` field — Zod `min(1)` validation so Submit stays disabled on empty input. The value is **never sent to the API** — it exists only to make the form look realistic for demo/evaluation purposes.
- After successful login, read `role` from the API response and redirect: `role === "officer"` → `/officer`, otherwise → `/operator`.
- No UI hint that any password is accepted — document in README instead.

---

## Backend

### Role-branching in `applications.py`

`GET /applications` and `GET /applications/{id}` change from `require_operator` to `get_current_user`. Inside each handler, a role check branches behaviour:

**`GET /applications`**
- `operator`: filter by `operator_id == user["sub"]`, return operator-mapped status labels, summary fields only. Existing behaviour preserved.
- `officer`: no operator filter, return all applications. Status uses officer-view labels (see mapping below). Response includes `operator_name` field derived from the `users` join.

**`GET /applications/{id}`**
- `operator`: existing behaviour — filters by `operator_id`, returns `latest_submission` + `latest_feedback` with operator-mapped status.
- `officer`: no ownership filter. Returns full audit trail — all submission rounds ordered by `round_number` ascending, each with `form_data`, `documents` (including AI results), and `feedback_items`. Status uses officer-view label. Includes `operator` block: `{ id, full_name, email, phone }`.

### Status label maps

```python
OPERATOR_STATUS_MAP = {
    "Application Received": "Submitted",
    "Under Review": "Under Review",
    "Pending Pre-Site Resubmission": "Pending Pre-Site Resubmission",
    "Pre-Site Resubmitted": "Pre-Site Resubmitted",
    "Site Visit Scheduled": "Pending Site Visit",
    "Awaiting Post-Site Clarification": "Pending Post-Site Clarification",
    "Pending Post-Site Resubmission": "Pending Post-Site Resubmission",
    "Post-Site Clarification Resubmitted": "Post-Site Resubmitted",
    "Pending Approval": "Pending Approval",
    "Approved": "Approved",
    "Rejected": "Rejected",
}

OFFICER_STATUS_MAP = {
    "Pending Approval": "Route to Approval",
    # all other internal statuses map to themselves
}
```

Officer handler applies `OFFICER_STATUS_MAP.get(status, status)` — identity for unmapped values.

### `services/status_machine.py`

```python
VALID_TRANSITIONS: dict[str, list[str]] = {
    "Application Received": ["Under Review"],
    "Under Review": ["Pending Pre-Site Resubmission", "Pending Approval", "Rejected"],
    "Pre-Site Resubmitted": ["Under Review"],
    "Pending Approval": ["Approved", "Rejected"],
}

class InvalidTransitionError(Exception):
    def __init__(self, current: str, new: str):
        self.current = current
        self.new = new
        super().__init__(f"Invalid status transition from '{current}' to '{new}'")

def transition(current: str, new: str) -> str:
    """Validate and return new_status. Raises InvalidTransitionError if invalid."""
    if new not in VALID_TRANSITIONS.get(current, []):
        raise InvalidTransitionError(current, new)
    return new
```

Called by both `POST /applications/{id}/feedback` and `PATCH /applications/{id}/status`. Operator-triggered transitions (`Application Received` on submit, `Pre-Site Resubmitted` on resubmit) bypass this — they are hardcoded in their own endpoints.

### `services/notifications.py`

```python
import logging

logger = logging.getLogger(__name__)

def notify(recipient_role: str, message: str) -> None:
    """Stub notification — logs to stdout. Swap transport here when real delivery is needed."""
    logger.info("[NOTIFY → %s] %s", recipient_role.upper(), message)
```

**Call sites and messages:**

| Event | Call |
|-------|------|
| Officer submits feedback | `notify("operator", f"Application {id} updated to '{new_status}'. Please log in to review officer feedback.")` |
| Officer transitions status only | `notify("operator", f"Application {id} status changed to '{new_status}'.")` |
| Operator resubmits | `notify("officer", f"Application {id} resubmitted (Round {round_number}). Ready for review.")` — add this call to the existing resubmit endpoint |

### `POST /applications/{id}/feedback`

**Auth:** `require_officer`

**Request body:**
```json
{
  "feedback_items": [
    {
      "target_type": "field",
      "section": "basic_details",
      "field_key": "uen",
      "document_id": null,
      "comment": "Please provide the correct UEN."
    },
    {
      "target_type": "document",
      "section": "documents",
      "field_key": null,
      "document_id": "<uuid>",
      "comment": "Fire Safety Certificate appears expired."
    }
  ],
  "new_status": "Pending Pre-Site Resubmission"
}
```

**Validation:**
- `feedback_items` must be non-empty.
- Each item: `target_type` is `"field"` or `"document"`.
- `target_type == "field"`: `field_key` required, `document_id` must be null. `section` must be one of `basic_details`, `operations`, `declarations`.
- `target_type == "document"`: `document_id` required and must belong to this application, `field_key` must be null. `section` must be `documents`.
- `comment` must be non-empty.
- `new_status` must be a valid internal status value and a valid transition from the current status (via `transition()`).

**Behaviour:**
1. Validate all items.
2. Call `transition(application.status, new_status)` — raises `InvalidTransitionError` on invalid move.
3. Create `FeedbackItem` rows linked to the latest submission. `created_by` set to officer's username from JWT.
4. Update `application.status` to `new_status`.
5. Call `notify("operator", ...)`.
6. Return `201`.

**Response 201:**
```json
{
  "application_id": "<uuid>",
  "status": "Pending Pre-Site Resubmission",
  "feedback_items": [{ "id": "<uuid>", "target_type": "field", "section": "basic_details", "field_key": "uen", "comment": "...", "created_by": "bob", "created_at": "ISO8601" }]
}
```

**Errors:** `400` validation, `404` not found, `409` invalid transition.

### `PATCH /applications/{id}/status`

**Auth:** `require_officer`

**Request:** `{ "new_status": "<internal status>" }`

**Behaviour:** Call `transition()`, update `application.status`, call `notify("operator", ...)`. No feedback items created.

**Response 200:** `{ "id": "<uuid>", "status": "<new internal status>", "updated_at": "ISO8601" }`

**Errors:** `400` unrecognised status, `404` not found, `409` invalid transition.

---

## Frontend

### `OfficerLayout`

**File:** `components/OfficerLayout.tsx`

Sidebar layout shell for `/officer` routes — mirrors `OperatorLayout` structure. Nav links: "Applications" (`/officer/applications`). Logout button clears `localStorage` and navigates to `/login`. Wraps all officer child routes via React Router's `<Outlet />`.

### New routes

Added to `routes.tsx`:

```tsx
{
  path: '/officer',
  element: <OfficerLayout />,
  children: [
    { index: true, element: <OfficerApplicationListPage /> },
    { path: 'applications', element: <OfficerApplicationListPage /> },
    { path: 'applications/:id', element: <OfficerApplicationDetailPage /> },
  ],
}
```

### Shared component: `ApplicationSections`

**File:** `components/ApplicationSections.tsx`

**Context:** `ApplicationDetailPage.tsx` was already redesigned (separate spec: `docs/superpowers/specs/2026-04-28-application-detail-redesign.md`) with inline section/field/document rendering logic using `frontend/src/lib/formLabels.ts` (which already exists). UC2 extracts that inline logic into this shared component.

Renders the three form sections (Basic Details, Operations, Declarations) plus a Documents card read-only from `formData` + `documents` props. Uses `SECTION_ORDER`, `DOC_TYPE_ORDER`, `FIELD_LABELS`, `SECTION_LABELS`, `DOC_TYPE_LABELS`, and `OPTIONAL_DOC_TYPES` imported from `lib/formLabels.ts`. Accepts optional `previousFormData` + `previousDocuments` — when provided, computes which fields and documents changed and renders a small "changed" badge on those items. No interactivity.

**Props:**
```ts
interface ApplicationSectionsProps {
  formData: Record<string, Record<string, unknown>>
  documents: Document[]
  feedbackByField?: Record<string, FeedbackItem[]>
  feedbackBySection?: Record<string, FeedbackItem[]>
  feedbackByDocument?: Record<string, FeedbackItem[]>
  previousFormData?: Record<string, Record<string, unknown>>
  previousDocuments?: Document[]
}
```

The inline feedback rendering (amber borders, `⚑ flagged` tags, callout blocks) is moved verbatim from `ApplicationDetailPage.tsx` into this component. `ApplicationDetailPage.tsx` is then refactored to delegate to `ApplicationSections`, passing its feedback index maps as props.

Used by:
- `ApplicationDetailPage` (operator) — passes feedback maps, no diff props.
- `OfficerApplicationDetailPage` — passes current + previous round data when on round 2+, no feedback maps (officer writes new feedback, not viewing existing operator-facing feedback).

### `OfficerApplicationListPage`

**Route:** `/officer/applications`

Calls `GET /applications` with officer token. Renders:
- Status filter dropdown — officer-view labels plus "All". Appends `?status=<value>` to the request.
- Table sorted by `updated_at` descending. Columns: Centre Name, Operator, Service Type, Round, Status (coloured badge), Last Updated.
- Clicking a row navigates to `/officer/applications/:id`.
- Empty state: "No applications matching this filter."

### `OfficerApplicationDetailPage`

**Route:** `/officer/applications/:id`

Calls `GET /applications/:id` with officer token. Side-by-side layout:

```
OfficerApplicationDetailPage
├── ApplicationHeader           — centre name, operator contact, status badge (officer label), current round
├── [left column — scrollable]
│   ├── SubmissionTabs          — "Round 1", "Round 2", ... defaulting to latest
│   │   ├── ChangesTab          — "Changes (N)" — before→after list for changed fields/docs; hidden on Round 1
│   │   └── FullSubmissionTab   — ApplicationSections (read-only, change badges on modified fields)
└── [right column — sticky top]
    └── FeedbackPanel
```

The right column uses `position: sticky; top: 1rem`. Left column has `overflow-y: auto`.

**Changes tab content:** Compares current round's `form_data` + `documents` against the previous round's. For each changed field: label, old value (strikethrough), arrow, new value. For each re-uploaded document: document type, "Re-uploaded", new AI status.

### `FeedbackPanel`

**File:** `components/FeedbackPanel.tsx`

Props: `applicationId`, `currentStatus`, `onSuccess` callback.

State: list of feedback item drafts, selected `newStatus`, submitting flag, error string.

```
FeedbackPanel
├── FeedbackItemList
│   └── FeedbackItemRow (repeatable)
│       ├── TargetTypeSelect    — "Form Field" | "Document"
│       ├── SectionSelect       — sections valid for target type
│       ├── FieldKeySelect      — visible when target = field
│       ├── DocumentSelect      — visible when target = document; lists docs from current submission
│       └── CommentInput        — textarea + "Insert template" dropdown
├── AddItemButton               — appends a new empty FeedbackItemRow
├── StatusSetter                — dropdown showing only valid next states for currentStatus
└── SubmitButton                — disabled until ≥1 item with comment + status selected
```

**Comment templates:**
- "Please provide a clearer copy of this document."
- "This field contains incorrect or inconsistent information."
- "The document appears to be expired or invalid."
- "The information provided does not match supporting documents."
- "Additional supporting evidence is required for this item."

**Valid next states** are derived from a frontend mirror of `VALID_TRANSITIONS` (a constant in `lib/statusMachine.ts`). Keys and values in the mirror are **internal status strings**. The `StatusSetter` dropdown maps each internal value to its officer-view label (via `OFFICER_STATUS_MAP`) for display, but sends the internal value in the API payload. The `currentStatus` prop passed to `FeedbackPanel` is always the internal status string.

**On submit:** calls `POST /applications/{id}/feedback`. On success: calls `onSuccess()` (parent re-fetches application data), resets panel to empty state, shows a success toast. On error: shows inline error message, preserves draft.

### `LoginPage` changes

- Remove role dropdown.
- Add `password` field with `min(1)` Zod validation. Value is never included in the API request.
- `POST /auth/login` sends `{ username }` only.
- On success, read `role` from response body: redirect to `/officer` or `/operator`.

---

## Error Handling

| Scenario | Backend | Frontend |
|----------|---------|----------|
| Invalid status transition | `409 { detail: "Invalid status transition from X to Y" }` | Inline error in FeedbackPanel, form preserved |
| Empty feedback_items | `400` | Submit button disabled client-side; server validates as defence-in-depth |
| document_id not in application | `400` | Document dropdown scoped to application docs — prevents this client-side |
| Application not found | `404` | Page-level error state "Application not found" |
| Officer accesses operator route | `403` | Redirect to login (existing axios 403 handling to be added) |
| Network / 500 error | — | Page-level or panel-level error message |

---

## Testing

### Backend (pytest + TestClient)

- `GET /applications` — officer token returns all applications; operator token returns own only.
- `GET /applications/{id}` — officer receives full submissions array; operator receives latest only.
- `POST /feedback` happy path — creates FeedbackItem rows, transitions status, returns 201.
- `POST /feedback` invalid transition — returns 409.
- `POST /feedback` empty items — returns 400.
- `PATCH /status` valid transition — returns 200 with new status.
- `PATCH /status` invalid transition — returns 409.
- `status_machine.transition()` — unit tested in isolation, no DB or HTTP.
- `notify()` — tested with `caplog` asserting log output at INFO level.
- `POST /auth/login` — returns role from DB; returns 401 for unknown username.

### Frontend (Vitest + Testing Library)

- `OfficerLayout` — renders nav links and logout; logout clears localStorage and redirects.
- `OfficerApplicationListPage` — renders rows; status filter updates displayed results.
- `OfficerApplicationDetailPage` — Changes tab shows before→after values on Round 2+; hidden on Round 1.
- `FeedbackPanel` — Submit disabled with no items; Submit disabled with no status; calls API and resets on success; preserves draft on error.
- `LoginPage` — Submit disabled when password empty; `role` field absent from API request payload; redirects to `/officer` for officer role.
