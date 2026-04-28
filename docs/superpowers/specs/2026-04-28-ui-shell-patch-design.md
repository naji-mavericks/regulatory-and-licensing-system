# UI Shell Patch — Design Spec

**Date:** 2026-04-28  
**Scope:** Operator-facing frontend pages (Login, Application List, Application Detail, Submit Form, Resubmission)  
**Approach:** Option A — minimal shell patch (sidebar nav + typography fix + status badge colours)

---

## 1. Sidebar Nav Shell

### Component: `OperatorLayout`

New file: `frontend/src/components/OperatorLayout.tsx`

A layout wrapper rendered for all `/operator/*` routes. Structure:

```
┌──────────────────────────────────────────────┐
│  Sidebar (fixed, 220px)  │  Main content      │
│  ─────────────────────── │                    │
│  [Logo / App Name]       │  <Outlet />        │
│                          │                    │
│  My Applications         │                    │
│  New Application         │                    │
│                          │                    │
│  [Username]              │                    │
│  Logout                  │                    │
└──────────────────────────────────────────────┘
```

**Sidebar details:**
- Width: `w-56` (224px), full viewport height `min-h-screen`
- Background: `bg-white border-r border-slate-200`
- App name at top: "Licensing Portal" in `text-sm font-semibold text-slate-800`
- Nav links use React Router `<NavLink>` for active state detection
- Active link style: `bg-indigo-50 text-indigo-700 font-medium`
- Inactive link style: `text-slate-600 hover:bg-slate-50`
- Role label displayed at bottom from `localStorage.getItem('role')` (e.g. "Operator") — username is not persisted post-login; deferred to auth context work
- Logout: clears `localStorage` token + role, navigates to `/login`

### Route wiring

`routes.tsx` wraps all `/operator/*` routes with `OperatorLayout` using a parent route with `<Outlet>`:

```
{ path: '/operator', element: <OperatorLayout />, children: [
  { index: true, element: <ApplicationListPage /> },
  { path: 'applications', element: <ApplicationListPage /> },
  { path: 'applications/:id', element: <ApplicationDetailPage /> },
  { path: 'applications/:id/resubmit', element: <ResubmissionPage /> },
  { path: 'apply', element: <SubmitApplicationPage /> },
]}
```

Login page (`/` and `/login`) remains outside `OperatorLayout`.

---

## 2. Typography Fix

**Problem:** `index.css` sets `color: var(--text)` (#6b6375 grey) globally on `:root`, which overrides Tailwind's `text-foreground` on body and bleeds grey into all text including headings.

**Fix:** Remove the `color: var(--text)` declaration from the `:root` block in `index.css`. The `@layer base` block already applies `body { @apply bg-background text-foreground; }` which correctly uses the dark foreground token. Headings styled with `font-bold` will render dark as expected.

Also remove the `font: 18px/145% var(--sans)` shorthand from `:root` — this overrides Tailwind's base font size. Keep `letter-spacing`, `font-synthesis`, `text-rendering`, and `-webkit-font-smoothing`.

---

## 3. Status Badge Component

### Component: `StatusBadge`

New file: `frontend/src/components/StatusBadge.tsx`

A small inline component that maps application status strings to colour-coded badges.

**Colour map:**

| Status value | Badge colours |
|---|---|
| `Application Received` | Blue: `bg-blue-50 text-blue-700` |
| `Under Review` | Blue: `bg-blue-50 text-blue-700` |
| `Pending Pre-Site Resubmission` | Amber: `bg-amber-50 text-amber-700` |
| `Pre-Site Resubmitted` | Purple: `bg-purple-50 text-purple-700` |
| `Approved` | Green: `bg-green-50 text-green-700` |
| `Rejected` | Red: `bg-red-50 text-red-700` |
| *(default)* | Grey: `bg-slate-100 text-slate-600` |

**Usage:** Replace the plain `<span className="... bg-slate-100 ...">` status spans in:
- `ApplicationListPage.tsx` — inside the application card
- `ApplicationDetailPage.tsx` — in the page header

---

## 4. Out of Scope

The following are explicitly deferred to a later Option B effort:
- Redesigning individual page layouts or card structures
- Form input component upgrades
- Officer dashboard / officer routes
- Toast notifications, animations, or rich interactive components

---

## 5. Files Changed

| File | Change |
|---|---|
| `frontend/src/components/OperatorLayout.tsx` | **New** — sidebar layout shell |
| `frontend/src/routes.tsx` | Wrap operator routes in `OperatorLayout` |
| `frontend/src/index.css` | Remove global `color` and `font` overrides from `:root` |
| `frontend/src/components/StatusBadge.tsx` | **New** — colour-coded status badge |
| `frontend/src/pages/ApplicationListPage.tsx` | Use `StatusBadge` |
| `frontend/src/pages/ApplicationDetailPage.tsx` | Use `StatusBadge` |
