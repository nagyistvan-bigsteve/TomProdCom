# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # dev server at http://localhost:4200 with live reload
npm run build      # production build → dist/tom-prod-com/browser/
npm test           # Karma + Jasmine test suite (watch mode)
npm run watch      # development build in watch mode
```

Deployment is handled automatically by GitHub Actions on push to `main` (Firebase Hosting).

## Architecture Overview

Angular 19 PWA for lumber depot order management. Mobile-first, supports Romanian and Hungarian.

**Stack:** Angular 19 (standalone components) · NgRX Signals · Angular Material + Bootstrap 5 · Supabase (PostgreSQL + Auth + RLS) · Firebase Hosting

**Layered flow:**
```
Pages & Components → NgRX Signal Stores → Query Services → Supabase
```

### State Management (NgRX Signals)

All state lives in `src/app/services/store/`:
- **`auth-store.ts`** — user auth, role (`user`/`admin`), approval status; persists to localStorage
- **`cart/`** — offer line items, totals; persists to localStorage
- **`client/`** — currently selected client
- **`product/`** — entity store for products, prices, stocks
- **`order/`** — active order during creation workflow
- **`custom-features/with-busy`** — reusable async loading state pattern used across stores

### Data Layer (`src/app/services/query-services/`)

Each service wraps Supabase queries as RxJS Observables. No direct Supabase calls outside these services.

### Routing & Guards

`app.routes.ts` defines the route tree. `auth-guard.service.ts` enforces three levels:
1. Unauthenticated → `/auth`
2. Authenticated but unapproved → `/wait-to-approve`
3. Non-admin accessing admin routes → `/offer`

Admin-only routes: `/settings`, `/deleted`

### Order Creation Workflow

Multi-step flow under `/offer`:
- `/offer/client` → select customer
- `/offer/create` → build cart (products, quantities, prices)
- `/offer/overview` → review and confirm

### Domain Model

Key types defined in `src/app/models/models.ts` and `src/app/models/enums.ts`:
- **Units:** `BUC` (pieces), `M2`, `M3`, `BUNDLE`
- **Categories:** `A`, `AB`, `B`, `T` (quality grades)
- **ClientType:** `PF` (individual), `PJ` (company — different pricing rules)
- **Size:** `NORMAL`, `EXTRA`, `EXTRA2`, `UNDEFINED`

### Internationalization

Translations at `src/assets/i18n/ro.json` (Romanian) and `hu.json` (Hungarian). Language is persisted to localStorage. i18n URLs include a version query string for cache-busting (`?v={version}`).

### PWA & Versioning

`AppVersionService` checks the deployed version on startup and forces a full page reload when a new version is detected — this is intentional to flush the service worker cache. `ngsw-config.json` controls caching strategy (prefetch for app shell, freshness for i18n).

## Mandatory Rules

- **Read `SPEC.md` before every architectural change** (new component, service, store, route, database table, or any pricing/auth/stock logic).
- **When business logic changes, update `SPEC.md`** — reflect the new intended behavior before or immediately after implementing it.
- **Also update `CLAUDE.md`** if the change affects architecture, conventions, or the domain model summary.

## Skills & Plugins — use these

Before writing code, invoke the matching skill or plugin rather than working from memory.

### Skills

| Skill | When to invoke |
|---|---|
| `angular-developer` | Any Angular component, service, store, routing, signals, forms, animations, DI, testing, or CLI work |
| `supabase` | Any Supabase task: auth, database, RLS, edge functions, realtime, storage, migrations, debugging |
| `supabase-postgres-best-practices` | Before writing or changing anything in the Postgres database (schema, columns, indexes, RLS, triggers, functions) |
| `frontend-design:frontend-design` | Aesthetic direction, typography, layout decisions, any new UI or visual redesign |
| `code-review` | After implementing a non-trivial change, before reporting it done |
| `verify` | To confirm a change works correctly in the running app |
| `security-review` | Any change touching auth, RLS, role logic, pricing, deletion, or sensitive operations |

### MCP Plugins

| Plugin | When to use |
|---|---|
| `context7` | Fetch current docs for Angular, Supabase, RxJS, NgRx, Material, or any third-party library before writing library-specific code |
| `supabase` (MCP) | Inspect schema, run migrations, query logs, manage branches, execute SQL directly against the project |

## Key Conventions

- All components are **standalone** (no NgModules)
- Prefer **Signals** over RxJS for new state; use RxJS only for async data fetching
- `SPEC.md` in the repo root is the authoritative business requirements document — consult it for domain rules (pricing logic, stock semantics, approval flow, etc.)
