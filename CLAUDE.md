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

- **Units:** `BUC` (pieces), `M2`, `M3`, `BOUNDLE` (bundles — spelled with a U in the enum; do not rename)
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
| `angular-material-design`          | Any component template, SCSS, or layout — spacing, typography, responsive breakpoints, Material component sizing  |
| `code-review`                      | After implementing a non-trivial change, before reporting it done                                                 |
| `verify`                           | To confirm a change works correctly in the running app                                                            |
| `security-review`                  | Any change touching auth, RLS, role logic, pricing, deletion, or sensitive operations                             |

### MCP Plugins

| Plugin           | When to use                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `context7`       | Fetch current docs for Angular, Supabase, RxJS, NgRx, Material, or any third-party library before writing library-specific code |
| `supabase` (MCP) | Inspect schema, run migrations, query logs, manage branches, execute SQL directly against the project                           |

## Layout & Styling System

### App Shell Layout

`app.component` wraps all authenticated pages in `<main class="app-content">`. This element:
- `padding-top: 56px` — clears the fixed topbar (`height: 56px`)
- `height: 100vh; display: flex; flex-direction: column` — lets child pages fill remaining height
- On desktop (≥960px): gains `margin-left: 280px` when `[class.sidebar-open]` is active, shifting content clear of the persistent sidebar

Page component `:host` selectors use `flex: 1` (not `height: 100%`) to fill the shell:
```scss
:host {
  flex: 1;
  min-height: 0;          /* required — see flex scroll trap below */
  display: flex;
  flex-direction: column;
  overflow: hidden;        /* or overflow: auto if the page itself scrolls */
  background-color: rgb(57, 72, 60);
}
```

> **Flex scroll trap — read this before adding internal scroll to any page:**
> Flexbox items default to `min-height: auto`, which lets a flex child grow to its full content size even when `flex: 1` is set. Without `min-height: 0` on every flex item in the chain, `overflow-y: auto` on a child element has no bounded height to scroll within — the element just expands to fit its content and the *parent* scrolls instead. Every `:host` that sits inside a flex column must declare `min-height: 0`. Similarly, any internal scrollable region (e.g. a list or table body) inside a flex column must also declare `min-height: 0` to be properly bounded.
>
> The same trap occurs when mixing `display: grid` inside a flex item: make the grid the scroll container's *child* (inner wrapper), not the scroll container itself, to keep separation of concerns clean.

### Topbar & Sidebar

- **Topbar** (`app-topbar`): `mat-toolbar`, `position: fixed` on `:host`, height `56px`, z-index 900.
- **Sidebar** (`app-sidebar`): `position: fixed; top: 56px; height: calc(100vh - 56px)`, z-index 800. On mobile it overlays with a backdrop; on desktop (≥960px) the backdrop is hidden via CSS so the sidebar acts as a persistent drawer — content shift is handled by `.sidebar-open` on `app-content`.

### Breakpoints

Breakpoint mixins live in `src/_breakpoints.scss`. Component SCSS files import them via:
```scss
@use 'breakpoints' as *;
```
This works because `angular.json` sets `stylePreprocessorOptions.includePaths: ["src"]`.

| Mixin | Min-width | Use for |
|---|---|---|
| `@include sm` | 600px | Tablet portrait |
| `@include md` | 960px | Tablet landscape / desktop |
| `@include lg` | 1280px | Large desktop |

Always write **mobile styles first**, then override with `sm`/`md`/`lg` blocks.

### Spacing Tokens

CSS custom properties in `styles.scss `:root``, available in all components without importing:

```
--space-1: 4px   --space-2: 8px   --space-3: 12px  --space-4: 16px
--space-6: 24px  --space-8: 32px  --space-12: 48px
```

Use `var(--space-N)` in `.scss` files. Bootstrap `p-*`/`gap-*` utilities are acceptable in templates (`p-3` = 12px, `p-4` = 16px).

### `mat-form-field` on dark backgrounds

`mat-form-field[appearance="outline"]` uses Material's default dark label/input colors. On pages with a dark background (`rgb(57, 72, 60)`), you must explicitly restyle the field. Use **both** CSS custom properties (for proper theming) and `::ng-deep` MDC class overrides (for reliability across Material versions):

```scss
// On the .field-class element (CSS custom properties cascade into the component)
.my-field {
  --mdc-outlined-text-field-label-text-color: rgba(255, 255, 255, 0.65);
  --mdc-outlined-text-field-hover-label-text-color: rgba(255, 255, 255, 0.85);
  --mdc-outlined-text-field-focus-label-text-color: white;
  --mdc-outlined-text-field-input-text-color: white;
  --mdc-outlined-text-field-outline-color: rgba(255, 255, 255, 0.35);
  --mdc-outlined-text-field-hover-outline-color: rgba(255, 255, 255, 0.65);
  --mdc-outlined-text-field-focus-outline-color: white;
  --mdc-outlined-text-field-caret-color: white;
}

// ::ng-deep MDC class overrides as fallback
::ng-deep {
  .my-field {
    .mdc-floating-label, .mat-mdc-floating-label { color: rgba(255, 255, 255, 0.65); }
    .mdc-text-field--focused .mdc-floating-label { color: white; }
    input.mdc-text-field__input { color: white; caret-color: white; }

    .mdc-text-field--outlined:not(.mdc-text-field--disabled) .mdc-notched-outline__leading,
    .mdc-text-field--outlined:not(.mdc-text-field--disabled) .mdc-notched-outline__notch,
    .mdc-text-field--outlined:not(.mdc-text-field--disabled) .mdc-notched-outline__trailing {
      border-color: rgba(255, 255, 255, 0.35);
    }
    .mdc-text-field--outlined.mdc-text-field--focused .mdc-notched-outline__leading,
    .mdc-text-field--outlined.mdc-text-field--focused .mdc-notched-outline__notch,
    .mdc-text-field--outlined.mdc-text-field--focused .mdc-notched-outline__trailing {
      border-color: white;
    }
  }
}
```

See `clients.component.scss` and `products.component.scss` for live examples.

### `mat-button-toggle-group` on dark backgrounds

Apply `::ng-deep` to style the toggle group and individual toggles:

```scss
::ng-deep {
  .my-toggle.mat-button-toggle-group { border-color: rgba(255, 255, 255, 0.25); }
  .my-toggle .mat-button-toggle { flex: 1; background: rgba(0,0,0,0.15); color: rgba(255,255,255,0.7); }
  .my-toggle .mat-button-toggle-button { width: 100%; }
  .my-toggle .mat-button-toggle-checked { background: rgba(255,255,255,0.18); color: white; font-weight: 600; }
}
```

### Anti-patterns (do not use)

- `height: 92vh` / `max-width: 96vw` — use flex `flex: 1` and `max-width` with `margin: 0 auto`
- `height: 100%` on page `:host` — use `flex: 1` instead
- `flex: 1` without `min-height: 0` on `:host` — causes the whole page to scroll instead of the intended inner element (see flex scroll trap above)
- Bootstrap `fs-*` for text sizing — use Material type classes (`mat-body-medium`, `mat-title-large`, etc.)
- Random `px` padding values — use `var(--space-N)` or Bootstrap utilities
- Component-scoped `tr.detail-row { height: 0 }` in Material table SCSS — Angular Material creates table rows through its own `ViewContainerRef`; they may not receive the component's `_ngcontent` scoping attribute. Use `::ng-deep tr.detail-row { height: 0 }` instead.
- Observable subscriptions (e.g. `formControl.valueChanges.subscribe(...)`) without `takeUntilDestroyed(this.destroyRef)` — if the component is navigated away from and back, old subscriptions accumulate and fire alongside new ones.

## Key Conventions

- All components are **standalone** (no NgModules)
- Prefer **Signals** over RxJS for new state; use RxJS only for async data fetching
- `SPEC.md` in the repo root is the authoritative business requirements document — consult it for domain rules (pricing logic, stock semantics, approval flow, etc.)
- **Unit tests**: Every bug fix or new feature that touches pricing, cart, or core business logic must include a matching Vitest test in a `<module>.vitest.spec.ts` file. Run with `npm run test:unit`. Angular component behaviour is covered by the existing Karma+Jasmine suite (`npm test`) but the suites are always emty. When you work on a new feature in a component or a new business logic or a bigger bug fix, you should extend the existing test files with new testcases. Pure helper functions must be exported so they can be tested without Angular DI.
