# Regulatory and Licensing System

A Regulatory and Licensing System for a Childcare/Student Care Centre use case. It manages the end-to-end application lifecycle between two actor types:

- **Operators** — businesses submitting licence applications
- **Officers** — government licensing officers reviewing and providing feedback

The core workflow is: submission → review → feedback → resubmission (multi-round), culminating in approval or rejection.

## Scope

This MVP implements Use Cases 1 & 2 (see `SCOPE.md` and `USE_CASES.md`). Use Case 3 (on-site assessment checklist) is deferred.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Tailwind v4, React Router v7, react-hook-form + zod |
| Backend | Python 3.13, FastAPI, SQLAlchemy 2.0, pydantic-settings |
| Database | PostgreSQL 16 |
| Infra | Docker Compose, GitHub Actions CI |

### Why this stack

- **React + TypeScript** — familiarity allowed faster delivery; TypeScript catches shape mismatches between API responses and UI early.
- **FastAPI** — automatic OpenAPI docs, pydantic request validation out of the box, and a shallow learning curve for REST APIs.
- **PostgreSQL** — JSONB support for storing flexible form data per submission round without a migration per field change; reliable and well-understood.
- **Docker Compose** — makes the repo self-contained for evaluation; no local database setup required.
- **GitHub Actions** — CI runs lint, tests, and security audits on every push, keeping the main branch shippable.

## Quick Start

> **No secrets committed** — `.env.example` files are provided for both `backend/` and `frontend/`. Copy them to `.env` and fill in your own values. The `.gitignore` excludes `.env` from version control.

### Prerequisites

- Python 3.13+
- Node.js 22+
- Docker and Docker Compose
- `uv` (Python package manager)

### All services (Docker)

```bash
docker compose up -d
```

This starts three services:
- **db** — PostgreSQL 16 on port 5432
- **api** — FastAPI on port 8000
- **frontend** — Vite dev server on port 5173

### Backend (standalone)

```bash
cd backend
cp .env.example .env   # or create .env with DATABASE_URL, JWT_SECRET
uv sync
uv run uvicorn app.main:app --reload
```

The API runs at `http://localhost:8000`. Swagger docs at `http://localhost:8000/docs`.

### Frontend (standalone)

```bash
cd frontend
cp .env.example .env   # or set VITE_API_URL=http://localhost:8000
npm install
npm run dev
```

The UI runs at `http://localhost:5173`.

### Seed data

```bash
cd backend
uv run python seed.py
```

Creates test users:
| Username | Role | Name |
|----------|------|------|
| alice | operator | Alice Operator |
| charlie | operator | Charlie Operator |
| bob | officer | Bob Officer |

Creates a sample application in "Pending Pre-Site Resubmission" status with one feedback item.

## Running Tests

### Backend

```bash
cd backend
uv run pytest tests/ -v
```

### Frontend

```bash
cd frontend
npx vitest run
```

## Git Hooks

Local pre-commit and pre-push hooks are provided in `.githooks/` to catch failures before they reach CI:

- **pre-commit** — runs `ruff format` + `ruff check` on staged backend files and ESLint on staged frontend files
- **pre-push** — runs the full `pytest` and `vitest` test suites before any push

To install on a fresh clone:

```bash
git config core.hooksPath .githooks
```

## Project Structure

```
backend/
  src/app/
    main.py              # FastAPI app with CORS, 3 routers
    config.py             # pydantic-settings (reads .env)
    models.py             # SQLAlchemy models
    auth/                 # JWT auth (router, dependencies, schemas)
    database/             # SQLAlchemy 2.0 engine + session
    routers/
      applications.py     # Dual-role endpoints (operator + officer)
      documents.py        # Document upload with AI verification stub
    services/
      ai_stub.py          # AI verification stub
      status_machine.py   # Status transition validation
      notifications.py    # Notification stub (logs to stdout)
  seed.py                 # Test data seeder
  alembic/                # Migration tooling
  tests/                  # pytest with SQLite test DB
frontend/
  src/
    main.tsx              # React 19 entry point
    App.tsx               # RouterProvider
    routes.tsx            # Route definitions
    pages/                # 7 page components
    components/           # Shared components + ui primitives
    lib/                  # API client, form labels, status machine
docker-compose.yml        # Docker services
.github/workflows/ci.yml  # CI pipeline
```

## Error Handling & Validation

| Layer | Approach |
|-------|----------|
| Backend — request shape | pydantic models on all request bodies; FastAPI returns 422 with field-level errors automatically |
| Backend — business rules | `status_machine.py` raises `InvalidTransitionError` on illegal transitions; caught and returned as 400 |
| Backend — authorization | `require_operator` / `require_officer` dependencies return 401/403 before any handler logic runs |
| Backend — document uploads | Validates presence of all 3 required doc types before creating a submission round |
| Frontend — new application form | `react-hook-form` + `zod` schema; fields are validated before the POST is sent |
| Frontend — resubmission | Only flagged fields are editable; unchanged fields are carried forward server-side, not re-validated |

## Mocks & Stubs

| Component | Implementation | Notes |
|-----------|---------------|-------|
| Auth | JWT with role claim, no passwords | Swap for real auth provider |
| File uploads | Local filesystem (`./uploads`) | Swap for S3/GCS in production |
| AI verification | Passes unless filename contains `fail-{doc_type}` | Swap for real AI service |
| Notifications | Logs to stdout | Swap transport for email/SMS/websocket |

## Status Machine

Valid transitions enforced by the backend and mirrored in the frontend:

```
Application Received → Under Review
Under Review → Pending Pre-Site Resubmission | Pending Approval | Rejected
Pre-Site Resubmitted → Under Review
Pending Approval → Approved | Rejected
```

Officer and Operator views use different labels for the same internal state (see `USE_CASES.md` for the full mapping).

The full assessment status model includes additional post-site states (Site Visit Scheduled, Awaiting Post-Site Clarification, etc.). These are explicitly deferred — only the pre-site submission and approval statuses are implemented. See `SCOPE.md` for the full deferral rationale.

## AI Usage

I used the following AI tools during this assessment:

1. **Claude Code** (models: Opus 4.7, Sonnet 4.6, Deepseek V4 Pro and Deepseek V4 Flash) via the **Superpowers Plugin**

### How I used it

My workflow was: requirements → specification → task breakdown → implementation, with AI handling the drafting at each stage and me reviewing and correcting before moving forward. The spec and plan files can be found in this codebase.

**Specification generation** — I fed the use case requirements into the Superpowers brainstorming skill to produce high-level specs. I reviewed each spec for correctness before allowing the AI to generate implementation tasks.

**Task breakdown** — The plugin generated a sequenced task list targeting TDD where possible. I validated each task for completeness and clear acceptance criteria before execution.

**Implementation** — Claude Code generated the code per task. I reviewed every diff before accepting it.

### Example prompts / instructions I gave the AI

- Providing the DB schema structure explicitly and correcting the AI's initial choice of data types (e.g. it used `String` for status fields that needed to be constrained enums).
- *"Officers and Operators are different roles. Never expose the internal approval stage to Operators — use `OPERATOR_STATUS_MAP` to translate before returning."*
- *"AI document verification must happen at upload time, not at submission time, so the operator gets immediate feedback per document."*
- Specifying that Docker Compose must be used so the repo is self-contained for evaluation.
- Requiring that the CI pipeline include both a security audit stage (`pip-audit`, `npm audit`) and a build stage, not just lint and test.

### Where I corrected AI output

- The initial status machine implementation did not validate transitions — the AI treated status as a free-form string update. I directed it to implement an explicit `VALID_TRANSITIONS` map with a `transition()` validator.
- The AI initially placed AI document verification as a background async call after submission. I redirected it to run synchronously at upload so the operator sees the result immediately.
- The resubmission endpoint initially required all form fields to be re-submitted. I corrected it to merge only the changed fields and carry forward unflagged documents server-side.

### Where AI was unhelpful

- Tailwind v4 configuration (using `@theme inline` in CSS rather than `tailwind.config.js`) required several correction rounds — the AI kept reverting to v3 patterns.
- Debugging UI issues with the AI was challenging. I had to rely more on manual inspection and provide more information like colorschemes and API response codes.

## What I Would Do Next

**Authentication**
- Password verification — the current login requires only a username. A production system needs password hashing (bcrypt), salting, and a proper credential store.

**Use Case 1 — Operator Submission**
- Drag-and-drop document uploads (current implementation uses a standard file input).
- Show officer feedback from all prior rounds, not just the most recent round.
- Server-side document content validation (current AI stub keys only on filename).

**Use Case 2 — Officer Review**
- Track resolution of previously flagged issues across resubmission rounds.
- Pagination on the officer applications list.
- Explicit per-round submission comparison view (diff highlighting exists in `ApplicationSections` but the officer cannot navigate between rounds directly).

**Use Case 3 — On-Site Assessment (deferred)**
- Full checklist capture workflow for site visits.
- Targeted post-site clarification visible only to the operator for flagged items.
- Draft save support (important for officers working on-site without reliable connectivity).

**Production hardening**
- Replace local file storage with S3 or GCS.
- Replace stdout notification stub with email/SMS transport.
- Add database migrations via Alembic (tooling is wired but no migrations exist yet).
- Role-based row-level security at the database layer.
- Rate limiting on the submission and upload endpoints.



