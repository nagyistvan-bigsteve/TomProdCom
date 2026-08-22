# core/

Singleton infrastructure that every feature depends on. Nothing in `core/` should import from `features/` or `shared/`.

## guards/
Route guards. `auth-guard.service.ts` enforces three access levels:
1. Unauthenticated → `/auth`
2. Authenticated but unapproved → `/wait-to-approve`
3. Non-admin on admin routes → `/offer`

`cuiValidator.ts` — Angular validator for Romanian CUI (company tax ID) format.

## models/
Domain-wide TypeScript types and constants. No business logic here.
- `models.ts` — primary interfaces (`Product`, `Client`, `Order`, `Price`, etc.)
- `enums.ts` — `Unit_id`, `Category`, `ClientType`, `Size`, `Language`, `UserRole`
- `animations.ts` — reusable Angular animation definitions

Import via alias: `@core/models/models`, `@core/models/enums`, `@core/models/animations`

## services/
Singleton app-level services (not feature-specific):
- `supabase.service.ts` — Supabase client wrapper; only place that constructs the client
- `install.service.ts` — PWA install prompt handler
- `app-version.service.ts` — checks deployed version on startup and force-reloads when a new version is detected

## store/
Global state not owned by any single feature:
- `auth-store.ts` — user session, role (`user`/`admin`), approval status; persists to localStorage
- `custom-features/with-busy/` — reusable NgRX Signals async-loading pattern used across all feature stores
