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
features/ (pages & components) → feature stores → feature services → @core/services/supabase.service
```

### Folder Structure (`src/app/`)

```
core/          Singleton infrastructure (guards, models, auth, supabase client)
shared/        Reusable UI and utilities shared across features
features/      Self-contained feature slices (each owns pages, components, services, store)
app.routes.ts  Top-level route tree
app.config.ts  Angular providers
app.component  Shell with <router-outlet>, topbar, sidebar
```

Each folder has its own `CLAUDE.md` with detailed context. Read the relevant one before working in that area.

### TypeScript Path Aliases

```
@core/*      → src/app/core/*
@shared/*    → src/app/shared/*
@features/*  → src/app/features/*
```

Use these aliases for all cross-folder imports. Relative imports are only acceptable within the same directory.

### core/ — Singleton Infrastructure

- **`guards/`** — `authGuard` (3-level access control), `cuiValidator` (Romanian CUI)
- **`models/`** — all domain interfaces, enums, animations
- **`services/`** — `SupabaseService` (client), `AppVersionService` (force-reload on deploy), `InstallService` (PWA prompt)
- **`store/auth-store.ts`** — global auth state (role, approved flag); persists to localStorage
- **`store/custom-features/with-busy/`** — reusable NgRX Signals async-loading pattern

### shared/ — Cross-Feature Reusables

- **`components/layout/`** — `TopbarComponent`, `SidebarComponent`, `LanguageSwitcherComponent`
- **`components/dialogs/`** — generic confirm-delete and confirm-restore dialogs
- **`directives/`** — `DecimalInputDirective`
- **`utils/`** — `NotificationService`, `filter.util`, `product.util`, `order-pdf-generator.util`

### features/ — Feature Slices

| Feature         | Routes                                                  | Owns                                   |
| --------------- | ------------------------------------------------------- | -------------------------------------- |
| `admin/`        | `/settings`, `/deleted`                                 | user approval, product/price admin     |
| `auth/`         | `/auth`, `/user`, `/wait-to-approve`, `/reset-password` | login, signup, account                 |
| `clients/`      | `/clients`                                              | client CRUD, client store              |
| `coming-wares/` | `/coming-wares`                                         | incoming stock tracking                |
| `orders/`       | `/offer/*`, `/orders`, `/offers`, `/deleted`            | offer workflow, cart store, PDF        |
| `products/`     | `/products`                                             | catalog, stock, pricing, product store |

### Routing & Guards

`app.routes.ts` defines the route tree. `authGuard` enforces three levels:

1. Unauthenticated → `/auth`
2. Authenticated but unapproved → `/wait-to-approve`
3. Non-admin accessing admin routes → `/offer`

Admin-only routes: `/settings`, `/deleted`

### Order Creation Workflow

Multi-step flow under `/offer`:

- `/offer/client` → select customer (`features/orders/pages/select-client/`)
- `/offer/create` → build cart (`features/orders/pages/create-offer/`)
- `/offer/overview` → review and confirm (`features/orders/pages/offer-overview/`)

State held in `@features/orders/store/cart/` and `@features/orders/store/order/`.

### Domain Model

Key types in `@core/models/models` and `@core/models/enums`:

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

| Skill                              | When to invoke                                                                                                    |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `angular-developer`                | Any Angular component, service, store, routing, signals, forms, animations, DI, testing, or CLI work              |
| `supabase`                         | Any Supabase task: auth, database, RLS, edge functions, realtime, storage, migrations, debugging                  |
| `supabase-postgres-best-practices` | Before writing or changing anything in the Postgres database (schema, columns, indexes, RLS, triggers, functions) |
| `frontend-design:frontend-design`  | Aesthetic direction, typography, layout decisions, any new UI or visual redesign                                  |
| `code-review`                      | After implementing a non-trivial change, before reporting it done                                                 |
| `verify`                           | To confirm a change works correctly in the running app                                                            |
| `security-review`                  | Any change touching auth, RLS, role logic, pricing, deletion, or sensitive operations                             |

### MCP Plugins

| Plugin           | When to use                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `context7`       | Fetch current docs for Angular, Supabase, RxJS, NgRx, Material, or any third-party library before writing library-specific code |
| `supabase` (MCP) | Inspect schema, run migrations, query logs, manage branches, execute SQL directly against the project                           |

## Key Conventions

- All components are **standalone** (no NgModules)
- Prefer **Signals** over RxJS for new state; use RxJS only for async data fetching
- `SPEC.md` in the repo root is the authoritative business requirements document — consult it for domain rules (pricing logic, stock semantics, approval flow, etc.)
- **Unit tests**: Every bug fix or new feature that touches pricing, cart, or core business logic must include a matching Vitest test in a `<module>.vitest.spec.ts` file. Run with `npm run test:unit`. Angular component behaviour is covered by the existing Karma+Jasmine suite (`npm test`) but the suites are always emty. When you work on a new feature in a component or a new business logic or a bigger bug fix, you should extend the existing test files with new testcases. Pure helper functions must be exported so they can be tested without Angular DI.
