# Multi-location: TOM ProdCom Instal

## Goal
The owner opened a second business, **TOM ProdCom Instal** (plumbing and heating installation goods). It runs in the same app. A switch in the app changes the location, and with it the products, orders and offers. The background color and the topbar logo change with a smooth transition.

## Status

| Phase | What | Effort | Status |
|---|---|---|---|
| 0 | Clickable mockup and owner questions | 0.5 day | ✅ Done 2026-11-25 |
| 1 | Foundation: location model, capabilities, theming, switch UI | 1–2 days | Next |
| 2 | Data separation: `location_id` in the database, filtering, RLS | 3–5 days | Waiting for Phase 1 |
| 3 | Instal product model: products, stock and PDF for Instal | 4–8 days | Waiting for owner answers |
| 4 | Hardening and release | 2–3 days | — |

Total: about 2–3 weeks. Phase 3 is the uncertain part.

## Decisions
- **2026-11-25:** Instal sells **different goods** (plumbing). No lumber grades (A/AB/B/T), no M3 or bundles, no truck intake, no sorting.
- **2026-11-25:** **Clients are shared** between locations. Orders and offers belong to one location.
- **2026-11-25:** **Every approved user can switch**, like the language switch. There are no per-user location rights for now. The design allows adding them later (see Principles).
- **2026-11-25:** Work happens on `feature/instal-location` (off `develop`), so `develop` is not blocked.

## Principles: no redesign, extend the existing architecture
This feature does **not** need a new app design. The existing layers (pages → stores → services → Supabase, RPCs for multi-row writes, RLS with `private.is_approved()` / `private.is_admin()`) stay. "Location" is added as a new dimension, in these ways:

1. **Location is data, not an `if`.**
   - A `locations` table in the database and a `LOCATIONS` config in the app.
   - Code never checks `location === 'instal'`. It checks a **capability** of the current location, for example `gradedStock`, `shipments`, `sorting`, `m3Units`.
   - A third location then needs only a config entry, not code changes.
2. **Additive database changes.**
   - New columns get `default 1` (lumber), so existing data, existing app versions and production keep working unchanged.
   - Nothing is renamed or dropped.
3. **Theme by tokens.**
   - Colors come from CSS variables set per location (`--app-bg`, `--topbar-bg`, `--accent`).
   - The 44 hard-coded `rgb(57, 72, 60)` values in component SCSS are replaced once.
4. **One store reacts to the location.**
   - Stores that load data reload in an `effect` on the current location, like they already do on `useAuthStore().id()`.
5. **Room for per-user location rights later.**
   - If the owner wants them, add a `user_locations` table and extend RLS. No schema rework needed.

## Regression checklist (must keep working)
Check this list at the end of Phases 1–4, for the **lumber location**. It must behave exactly as before.

- [ ] Auth: 3-level guard (unauthenticated → `/auth`, unapproved → `/wait-to-approve`, non-admin on admin routes → `/offer`); approve and deny user (`deny_user`).
- [ ] Graded stock: T taken from A, products > 7 m only AB, M2 not tracked (`stockCategoryFor()` ↔ SQL `stock_category_for`).
- [ ] Shipment validation puts stock in as AB. Sorting moves AB to A, B or waste.
- [ ] Hand stock edit through `set_stock` writes `stock_adjustments`.
- [ ] Offer create, edit, convert to order (stock booking). Order items checks.
- [ ] Deleted orders give stock back. Restore works. The nightly pg_cron purge still runs.
- [ ] Pricing for PF / PJ, TVA reverse charge, delivery fee, voucher, paid amount.
- [ ] PDF of an offer or order (company data, totals).
- [ ] Orders: default sort order, filters, search, date filter.
- [ ] RO / HU: translations, `appDate` and `money` formats.
- [ ] Central API error toasts. PWA version reload.
- [ ] `npm run test:unit` and `npx ng test --watch=false` are green (run from `D:\`).

## Phase 0: Mockup ✅
- [docs/mockups/location-switch.html](../mockups/location-switch.html): the built single file with logos embedded. Send it to the owner as is.
- [docs/mockups/location-switch.template.html](../mockups/location-switch.template.html): the source.
- `node docs/mockups/build-mockup.mjs` rebuilds the HTML from the template.
- The Instal logo is at `src/assets/images/logo-instal.png`. It is a wide wordmark: use the icon crop in the topbar and the full logo in the sidebar.
- Choices shown in the mockup:
  - The switch is a toggle in the topbar (tree / drop), plus location cards in the sidebar.
  - Colors: lumber `rgb(57,72,60)` and topbar `rgb(73,92,76)`; Instal `rgb(22,52,92)` and topbar `rgb(30,72,126)`, accent `#5cb8f2`.
  - Transition: a circle reveal from the switch (View Transitions API), with a fade as the fallback.
  - Switching with a non-empty cart asks for confirmation, then empties the cart.

## Phase 1: Foundation (UI only, no data filtering yet)
- `src/app/core/models/locations.ts` holds the `LOCATIONS` config per location:
  - id, code (`LUMBER`, `INSTAL`), i18n name key, theme colors, logo path, PDF company-data i18n prefix (`TOMPRODCOM.*`, `TOMINSTAL.*`).
  - `capabilities` (`gradedStock`, `shipments`, `sorting`, …).
- `src/app/core/store/location.store.ts`: `currentLocation` signal, persisted to localStorage (key `selectedLocation`) like `LanguageService` does for the language. Uses `core/store/local-storage-sync.ts`.
- Theming:
  - `AppComponent` sets `data-location` on `<body>`.
  - `styles.scss` defines the tokens per location and registers them with `@property`, so the colors animate.
  - Replace the hard-coded background colors in component SCSS.
- Topbar: a logo cross-fade and the switch component next to `LanguageSwitcherComponent`.
- Sidebar: location cards, and menu items filtered by capability.
- Switch with a non-empty cart: confirm dialog (reuse the shared dialog pattern), then clear the cart store.
- Tests:
  - Vitest for the location config and capability helpers.
  - Component specs for the switch and topbar.
- Update CLAUDE.md (theming tokens, location store) and SPEC.md (new "Locations" section).

## Phase 2: Data separation
- Migration: a `locations` table (`smallint` id, code). RLS: read for `private.is_approved()`; write admin only.
- Migration: `location_id smallint not null default 1 references locations` on `products`, `orders` and `shipments`, with indexes.
  - `stocks`, `prices_new` and `stock_sortings` follow their product.
  - `order_items` follow their order.
  - `clients` stays shared.
- A trigger check (`search_path = public`) makes sure an order item's product belongs to the order's location.
- The RPCs that create or replace orders and offers, convert offers and book stock take or derive `location_id`.
- Services filter by the current location: `products.service.ts`, `prices.service.ts`, `orders.service.ts`, `shipments.service.ts`, `stocks.service.ts`, `sortings.service.ts`.
- Stores (`ProductStore`, the order stores, the shipment store) reload in an `effect` on the location.
- Apply to staging first. The default of 1 keeps `develop` working. Apply to production only right before the release.
- Rollback script in `supabase/rollbacks/`.

## Phase 3: Instal product model (depends on owner answers)
- **Key finding:** `products` is lumber-shaped (`thickness`, `width`, `length`, `m2_brut`, `m2_util`, `piece_per_pack`, `size_id`). Plumbing products need other fields (code, brand, diameter…).
- Proposal:
  - Keep **one `products` table**, so orders, prices and stock keep working through the same code.
  - Make the lumber columns nullable for Instal products.
  - Add generic columns (`code`), and `attributes jsonb` for location-specific fields.
  - Decide this after the owner says what Instal sells.
- Stock: one ungraded stock row per Instal product.
  - `stockCategoryFor()` and SQL `stock_category_for` return the ungraded bucket when the location lacks the `gradedStock` capability.
  - Tests on both sides.
- Units: add `M` (meter) and `SET` if needed. The enum keeps `BOUNDLE` as is.
- Product create, edit and list: hide the category, size and dimension fields per capability.
- PDF: company data from the location config.
- Pricing for PF / PJ at Instal: per the owner's answer.
- Catalog import (Excel), if the owner has one.

## Phase 4: Hardening and release
- Go through the full regression checklist on staging, for both locations.
- Run `security-review` (RLS and RPC changes) and `code-review`.
- Run Supabase advisors on staging and production.
- Production migration, then merge `feature/instal-location` → `develop` → `main`.

## Open questions for the owner
1. What does Instal sell, and in which units (piece, meter, set)? Roughly how many products? Is there a catalog (Excel) to import?
2. Does the offer PDF need other company data for Instal (CUI, address, phone, bank account)?
3. Are prices and discounts for PF / PJ the same as at the depot? VAT and reverse charge the same?
4. Is stock tracked at Instal? How do goods come in (supplier deliveries)?
5. Should order and offer numbers be separate per location?
6. Does the admin need a combined view (both locations) on Orders, Offers or Deleted?
7. When the app opens: the last used location, or a default location per user?
8. Cart on switch: empty it (as in the mockup), or keep one cart per location?

## Log
- **2026-11-25:** Plan created. Branch `feature/instal-location` created. Phase 0 mockup built and checked with headless Chrome screenshots. Instal logo added to assets.
