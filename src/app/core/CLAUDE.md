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
- `auth.service.ts` — sign-up, sign-in, sign-out, session, own profile (throws on error)
- `users.service.ts` — user lists, approve, deny, `set_user_role` (throws on error)
- `supabase-result.util.ts` — `unwrapResult()`: returns `data`, throws `error` from a supabase-js response
- `install.service.ts` — PWA install prompt handler
- `app-version.service.ts` — checks deployed version on startup and force-reloads when a new version is detected
- `language.service.ts` — current UI language (`current()` signal), applies it to ngx-translate and remembers it in localStorage (`selectedLanguage`); `init()` once in `AppComponent`, `toggle()` from the switcher. `language.util.ts` holds the pure `parseLanguage()`

## store/
Global state not owned by any single feature:
- `auth-store.ts` — user session, role (`user`/`admin`), approval status; cached in localStorage (`auth`) as a startup hint. Talks to Supabase only through `services/auth.service.ts`.
- `users.store.ts` — admin user management: approved users, users waiting for approval (topbar badge), approve / deny / toggle role, through `services/users.service.ts`. In memory only; cleared on logout.
- `local-storage-sync.ts` — `syncToLocalStorage(key, select)` keeps a key in step with store state (`null` removes it, `undefined` leaves it alone); `readFromLocalStorage(key)`. Used by the auth and cart stores.
- `custom-features/with-busy/` — reusable NgRX Signals async-loading pattern used across all feature stores
