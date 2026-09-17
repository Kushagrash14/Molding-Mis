# Production & OEE Tracker — Prototype

A React (Vite) prototype of the shop-floor shift entry and OEE tracking
system described in the implementation plan — digitizing the existing
injection-molding production Excel sheet.

This is a **frontend-only prototype**. Data is kept in the browser
(`localStorage`), not a real database, so it's meant for demoing the
workflow and UI to stakeholders and for extending into the real backend
described in the plan (Postgres schema, calc engine, lock system, RBAC).

## Getting started

```bash
npm install
npm run dev
```

Open the printed local URL (usually `http://localhost:5173`). The app
opens automatically.

To build a production bundle:

```bash
npm run build
npm run preview   # serve the built files locally to check the build
```

## What's implemented

- **Shift entry form** — select a SAP code, auto-fill mould/part master
  data, log run hour / OK production / downtime / rejections, see OEE and
  every derived metric calculate live using the same formulas as the
  server-side calc engine in the plan.
- **Lock system** — a submitted entry automatically locks once its shift
  date is no longer "today" (simulates the hourly cutoff cron job). Locked
  entries render as plain read-only data for operators — no lock icon, no
  "contact admin" message, by design.
- **Admin override** — admins can edit any entry directly, including
  locked ones, with every override written to a silent audit log.
- **Role-based screens** — switch the "USER" dropdown in the top bar
  between an operator, a supervisor, and admin to see each role's screen.
- **Dashboard** — average OEE, downtime pareto, rejection pareto, and
  manpower-variance count, rolled up from logged entries.
- **Master data admin** — add new SAP code / part / mould rows.

## Project structure

```
src/
  main.jsx              entry point
  App.jsx                top-level state + screen routing
  index.css              design tokens + all component styles
  data/
    seedData.js           master data, machines, shifts, reasons, demo users
  lib/
    calculations.js        the OEE calc engine (§4 of the plan)
    storage.js              localStorage persistence layer
  components/
    TopBar.jsx
    Sidebar.jsx
    EntryForm.jsx
    EntriesTable.jsx
    EditModal.jsx
    Dashboard.jsx
    MasterAdmin.jsx
    AuditLogView.jsx
    Pill.jsx
    MetricsPreview.jsx
```

## Moving this to production

This prototype intentionally keeps every server-side concept
(`lib/calculations.js`, `lib/storage.js`) isolated so it's a small swap to
wire up a real backend:

1. Replace `lib/storage.js` with real API calls (`POST /api/v1/entries`,
   `PATCH /api/v1/entries/{id}`, etc.) — see the implementation plan for
   the full API surface.
2. Move `computeMetrics` server-side so it's the single source of truth,
   as the plan specifies — the client can still call it for the live
   preview, but the server value must be authoritative on save.
3. Replace the client-side "today" lock check with the real hourly cron
   job against the database.
4. Add real authentication in place of the demo user dropdown.
5. Swap `data/seedData.js` for the real `sap_master`, `machines`,
   `shift_master`, and `reason_codes` tables.

See the full **Shop-Floor Production & OEE Tracking System — Implementation
Plan** document for the complete database schema, API surface, RBAC
matrix, and phased rollout plan this prototype is built from.

## Tech stack

- React 18
- Vite 5
- No external UI or state-management libraries — plain CSS custom
  properties + React state, kept deliberately light so it's easy to read
  and extend.
