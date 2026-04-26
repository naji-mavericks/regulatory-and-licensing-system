# Task Breakdown Design — Regulatory and Licensing System

**Date:** 2026-04-26
**Scope:** Use Cases 1 & 2 + Infrastructure (UC3 deferred)
**Granularity:** Medium — one task per vertical slice, backend and frontend separated within each epic

---

## Organisation

Tasks are grouped by epic and tracked as GitHub Issues on `naji-mavericks/regulatory-and-licensing-system`. Each issue is labelled by epic. The GitHub Project board displays issues and moves them automatically via `closes #X` in PR descriptions.

### Labels
- `infra`
- `uc1-submission`
- `uc1-resubmission`
- `uc2-review`
- `uc2-feedback`

---

## Epic: Infra

| ID | Title | Notes |
|----|-------|-------|
| I-1 | Scaffold backend | FastAPI project with uv, folder structure, health endpoint |
| I-2 | Scaffold frontend | Vite + React + TypeScript, React Hook Form + Zod, shadcn/ui, basic routing |
| I-3 | Docker Compose setup | Services: api, db (postgres), frontend; dev volumes |
| I-4 | Database migrations setup | Alembic wired to SQLAlchemy models |
| I-5 | Auth stub | JWT issue/verify, role claim (`operator`/`officer`), login endpoint |
| I-6 | CI pipeline | GitHub Actions: lint + test on PR for both backend and frontend |

---

## Epic: UC1 — Operator Application Submission

| ID | Title | Notes |
|----|-------|-------|
| UC1-1 | Application schema & DB migration | `applications` table, `submissions` table, status enum, JSONB for form data |
| UC1-2 | Submit application API | `POST /applications` — create application + first submission, trigger AI stub per doc |
| UC1-3 | Get application API | `GET /applications/{id}` — full form data, docs, AI results, status |
| UC1-4 | Submit application UI — form | Multi-section form (React Hook Form + Zod), drag-and-drop doc upload, AI status indicator per doc, progress indicator |
| UC1-5 | Submit application UI — confirmation | Post-submit state, status display using operator-mapped labels |

---

## Epic: UC1 — Operator Resubmission

| ID | Title | Notes |
|----|-------|-------|
| UC1-6 | Resubmission API | `POST /applications/{id}/resubmit` — save new submission round, preserve history |
| UC1-7 | Get submission history API | `GET /applications/{id}/submissions` — all rounds, officer comments per round |
| UC1-8 | Resubmission UI | Officer comments prominent at top, only flagged sections editable, previous rounds visible |

---

## Epic: UC2 — Officer Application Review

| ID | Title | Notes |
|----|-------|-------|
| UC2-1 | Application list API | `GET /applications` — officer view, filterable by status |
| UC2-2 | Application list UI | Officer dashboard, status filter, sorted by last updated |
| UC2-3 | Application detail API | `GET /applications/{id}` — officer view with all submissions, AI results, audit trail |
| UC2-4 | Application detail UI | Full form data + docs organised by section, AI flags visible, diff highlighting on resubmissions |

---

## Epic: UC2 — Officer Feedback & Status Transitions

| ID | Title | Notes |
|----|-------|-------|
| UC2-5 | Feedback API | `POST /applications/{id}/feedback` — comments linked to section/doc, status transition, notify operator (stub) |
| UC2-6 | Status transition API | `PATCH /applications/{id}/status` — enforces valid state machine transitions |
| UC2-7 | Feedback UI | Per-section/doc comment input, predefined comment templates, status setter |
| UC2-8 | Notification stub | In-app or console notification when operator resubmits (officer) and when officer acts (operator) |

---

## Key Constraints

- Auth is a JWT stub — no database-backed user store
- File uploads stored locally
- AI document verification is stubbed with fixed responses keyed on filename
- Operator-facing status labels differ from internal/officer labels — both API and UI must respect the mapping defined in `USE_CASES.md`
- Status transitions must follow the valid state machine — invalid transitions rejected by `UC2-6`
- Full audit trail (all submission rounds, feedback, timestamps) must be preserved — never overwrite
