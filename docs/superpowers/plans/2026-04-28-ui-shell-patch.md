# UI Shell Patch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent sidebar nav shell to all operator pages, fix grey typography caused by a CSS variable conflict, and introduce colour-coded status badges.

**Architecture:** Three independent changes — CSS fix in `index.css`, two new components (`StatusBadge`, `OperatorLayout`), route rewiring in `routes.tsx`, and badge usage in two existing pages. Each change is isolated and can be committed separately.

**Tech Stack:** React 19, React Router v7 (nested routes / `<Outlet>`), Tailwind v4, Vitest + Testing Library

---

## File Map

| File | Action |
|---|---|
| `frontend/src/index.css` | Modify — remove global `color` and `font` overrides from `:root` |
| `frontend/src/components/StatusBadge.tsx` | Create |
| `frontend/src/components/StatusBadge.test.tsx` | Create |
| `frontend/src/components/OperatorLayout.tsx` | Create |
| `frontend/src/components/OperatorLayout.test.tsx` | Create |
| `frontend/src/routes.tsx` | Modify — nest operator routes under `OperatorLayout` |
| `frontend/src/pages/ApplicationListPage.tsx` | Modify — use `StatusBadge` |
| `frontend/src/pages/ApplicationDetailPage.tsx` | Modify — use `StatusBadge` |

---

## Task 1: Fix typography CSS overrides

**Files:**
- Modify: `frontend/src/index.css`

The `:root` block sets `color: var(--text)` (#6b6375 grey) and `font: 18px/145% var(--sans)` globally. These override Tailwind's `body { @apply text-foreground }` and make all headings render grey. Remove both declarations.

- [ ] **Step 1: Remove global color and font overrides from `:root`**

Open `frontend/src/index.css`. In the `:root` block (lines 8–98), delete these two lines:

```css
color: var(--text);
```
and
```css
font: 18px/145% var(--sans);
letter-spacing: 0.18px;
```

Keep all other lines in the `:root` block. The block after the edit should still have `color-scheme`, `font-synthesis`, `text-rendering`, `-webkit-font-smoothing`, `-moz-osx-font-smoothing`, and all the CSS variable declarations.

The `@media (max-width: 1024px) { font-size: 16px; }` block inside `:root` can also be removed since the font shorthand is gone.

- [ ] **Step 2: Verify the app builds without errors**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

Expected: build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "fix: remove global color and font overrides from CSS root that conflicted with Tailwind"
```

---

## Task 2: StatusBadge component

**Files:**
- Create: `frontend/src/components/StatusBadge.tsx`
- Create: `frontend/src/components/StatusBadge.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/StatusBadge.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd frontend && npx vitest run src/components/StatusBadge.test.tsx 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module './StatusBadge'`

- [ ] **Step 3: Implement StatusBadge**

Create `frontend/src/components/StatusBadge.tsx`:

```tsx
const STATUS_CLASSES: Record<string, string> = {
  'Application Received': 'bg-blue-50 text-blue-700',
  'Under Review': 'bg-blue-50 text-blue-700',
  'Pending Pre-Site Resubmission': 'bg-amber-50 text-amber-700',
  'Pre-Site Resubmitted': 'bg-purple-50 text-purple-700',
  'Approved': 'bg-green-50 text-green-700',
  'Rejected': 'bg-red-50 text-red-700',
}

export default function StatusBadge({ status }: { status: string }) {
  const classes = STATUS_CLASSES[status] ?? 'bg-slate-100 text-slate-600'
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${classes}`}>
      {status}
    </span>
  )
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd frontend && npx vitest run src/components/StatusBadge.test.tsx 2>&1 | tail -10
```

Expected: all 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/StatusBadge.tsx frontend/src/components/StatusBadge.test.tsx
git commit -m "feat: add StatusBadge component with colour-coded status mapping"
```

---

## Task 3: OperatorLayout component

**Files:**
- Create: `frontend/src/components/OperatorLayout.tsx`
- Create: `frontend/src/components/OperatorLayout.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/OperatorLayout.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import OperatorLayout from './OperatorLayout'

const renderWithRouter = (initialEntry = '/operator/applications') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/operator" element={<OperatorLayout />}>
          <Route path="applications" element={<div>Applications Page</div>} />
          <Route path="apply" element={<div>Apply Page</div>} />
        </Route>
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  )

describe('OperatorLayout', () => {
  beforeEach(() => {
    localStorage.setItem('role', 'operator')
    localStorage.setItem('token', 'test-token')
  })

  it('renders the app name', () => {
    renderWithRouter()
    expect(screen.getByText('Licensing Portal')).toBeInTheDocument()
  })

  it('renders My Applications nav link', () => {
    renderWithRouter()
    const link = screen.getByRole('link', { name: /my applications/i })
    expect(link).toHaveAttribute('href', '/operator/applications')
  })

  it('renders New Application nav link', () => {
    renderWithRouter()
    const link = screen.getByRole('link', { name: /new application/i })
    expect(link).toHaveAttribute('href', '/operator/apply')
  })

  it('renders the outlet content', () => {
    renderWithRouter()
    expect(screen.getByText('Applications Page')).toBeInTheDocument()
  })

  it('displays the role label', () => {
    renderWithRouter()
    expect(screen.getByText(/operator/i)).toBeInTheDocument()
  })

  it('logout clears localStorage and navigates to /login', () => {
    renderWithRouter()
    fireEvent.click(screen.getByRole('button', { name: /logout/i }))
    expect(localStorage.getItem('token')).toBeNull()
    expect(localStorage.getItem('role')).toBeNull()
    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd frontend && npx vitest run src/components/OperatorLayout.test.tsx 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module './OperatorLayout'`

- [ ] **Step 3: Implement OperatorLayout**

Create `frontend/src/components/OperatorLayout.tsx`:

```tsx
import { Outlet, NavLink, useNavigate } from 'react-router-dom'

export default function OperatorLayout() {
  const navigate = useNavigate()
  const role = localStorage.getItem('role') ?? 'operator'

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    navigate('/login')
  }

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
      isActive
        ? 'bg-indigo-50 text-indigo-700 font-medium'
        : 'text-slate-600 hover:bg-slate-50'
    }`

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-white flex flex-col">
        <div className="px-4 py-5 border-b border-slate-100">
          <span className="text-sm font-semibold text-slate-800">Licensing Portal</span>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          <NavLink to="/operator/applications" className={navLinkClass}>
            My Applications
          </NavLink>
          <NavLink to="/operator/apply" className={navLinkClass}>
            New Application
          </NavLink>
        </nav>

        <div className="px-4 py-4 border-t border-slate-100 flex flex-col gap-2">
          <span className="text-xs text-slate-500 capitalize">{role}</span>
          <button
            onClick={handleLogout}
            className="text-left text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd frontend && npx vitest run src/components/OperatorLayout.test.tsx 2>&1 | tail -10
```

Expected: all 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/OperatorLayout.tsx frontend/src/components/OperatorLayout.test.tsx
git commit -m "feat: add OperatorLayout sidebar shell with nav and logout"
```

---

## Task 4: Wire OperatorLayout into routes

**Files:**
- Modify: `frontend/src/routes.tsx`

- [ ] **Step 1: Replace flat operator routes with nested layout routes**

Replace the entire content of `frontend/src/routes.tsx` with:

```tsx
import { createBrowserRouter } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import OperatorLayout from './components/OperatorLayout'
import ApplicationListPage from './pages/ApplicationListPage'
import SubmitApplicationPage from './pages/SubmitApplicationPage'
import ApplicationDetailPage from './pages/ApplicationDetailPage'
import ResubmissionPage from './pages/ResubmissionPage'

export const router = createBrowserRouter([
  { path: '/', element: <LoginPage /> },
  { path: '/login', element: <LoginPage /> },
  {
    path: '/operator',
    element: <OperatorLayout />,
    children: [
      { index: true, element: <ApplicationListPage /> },
      { path: 'applications', element: <ApplicationListPage /> },
      { path: 'applications/:id', element: <ApplicationDetailPage /> },
      { path: 'applications/:id/resubmit', element: <ResubmissionPage /> },
      { path: 'apply', element: <SubmitApplicationPage /> },
    ],
  },
])
```

- [ ] **Step 2: Run the full test suite to confirm nothing broke**

```bash
cd frontend && npx vitest run 2>&1 | tail -20
```

Expected: all tests pass (existing page tests wrap components in `MemoryRouter` independently so they are unaffected by this route change)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/routes.tsx
git commit -m "feat: nest operator routes under OperatorLayout shell"
```

---

## Task 5: Use StatusBadge in ApplicationListPage

**Files:**
- Modify: `frontend/src/pages/ApplicationListPage.tsx`

- [ ] **Step 1: Replace the inline status span with StatusBadge**

In `frontend/src/pages/ApplicationListPage.tsx`:

1. Add the import at the top (after the existing imports):
```tsx
import StatusBadge from '../components/StatusBadge'
```

2. Replace the status span (currently around line 68):
```tsx
// Remove this:
<span className="text-sm bg-slate-100 px-2 py-1 rounded">
  {app.status}
</span>

// Replace with:
<StatusBadge status={app.status} />
```

- [ ] **Step 2: Run ApplicationListPage tests**

```bash
cd frontend && npx vitest run src/pages/ApplicationListPage.test.tsx 2>&1 | tail -10
```

Expected: all 5 tests pass. The test `expect(screen.getByText('Submitted')).toBeInTheDocument()` continues to pass because `StatusBadge` renders the status text.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ApplicationListPage.tsx
git commit -m "feat: use StatusBadge in ApplicationListPage"
```

---

## Task 6: Use StatusBadge in ApplicationDetailPage

**Files:**
- Modify: `frontend/src/pages/ApplicationDetailPage.tsx`

- [ ] **Step 1: Replace the inline status span with StatusBadge**

In `frontend/src/pages/ApplicationDetailPage.tsx`:

1. Add the import at the top (after existing imports):
```tsx
import StatusBadge from '../components/StatusBadge'
```

2. Replace the status span (currently around line 59):
```tsx
// Remove this:
<span className="text-sm bg-slate-100 px-3 py-1 rounded">{app.status}</span>

// Replace with:
<StatusBadge status={app.status} />
```

- [ ] **Step 2: Run ApplicationDetailPage tests**

```bash
cd frontend && npx vitest run src/pages/ApplicationDetailPage.test.tsx 2>&1 | tail -10
```

Expected: 1 test passes. The test `expect(await screen.findByText('Submitted')).toBeInTheDocument()` continues to pass.

- [ ] **Step 3: Run the full test suite one final time**

```bash
cd frontend && npx vitest run 2>&1 | tail -20
```

Expected: all tests pass across all files.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ApplicationDetailPage.tsx
git commit -m "feat: use StatusBadge in ApplicationDetailPage"
```
