# Cleanup of the lumber code before multi-location

## Goal
Fix real pricing and cart bugs. Reduce the price lookup and the volume math to one tested version each. Build a safety net (baseline schema, SQL tests) before multi-location adds a location to exactly this code. This is a cleanup, not a redesign.

**Branch:** `refactor/pre-location`, off `develop`. It is merged and released on its own, then `feature/instal-location` is rebased on it.
**Order of work:** this cleanup → [action history](action-history.md) → [multi-location](multi-location.md) Phase 1.

## Status

| Step | What | Effort | Status |
|---|---|---|---|
| 1 | Bug fixes: TVA on add, category recursion, cart merge, cart and stores after sign-out | 1.5 days | ✅ Done 2026-11-25 |
| 2 | One price lookup, one volume formula, inline math to tested helpers, Vitest gaps | 1.5 days | ✅ Done 2026-11-25 |
| 3 | Baseline migration, schema drift check, SQL test script, magic ids to enums, small tidy-ups | 1.5–2 days | ✅ Done 2026-11-25 (owner decision open: align staging/production columns) |

## Step 1: Bug fixes
1. **TVA on first add.**
   - `selected-product.component.ts` `calculatePrice()` applies only `applyBDiscount`, while the cart list path (`getExactPrice`) uses `effectiveUnitPrice(…, isTva)`.
   - Result: a PJ `tva=true` client's M3 or bundle line can start at the full price.
   - Fix: both paths use `effectiveUnitPrice`.
2. **Infinite recursion.**
   - `updateCategory()` in `selected-product-list.component.ts` calls itself forever when no category has a price.
   - Fix: stop after one cycle.
3. **Cart merge.**
   - `checkForDuplicatedItems` in `cart.store.ts` sums only the first two duplicates.
   - Fix: a pure `mergeDuplicateItems` that sums all matches.
4. **Sign-out.**
   - The cart (`product_items_data` in localStorage) survives sign-out, so it is visible to the next user on a shared device.
   - Fix: clear it, and reset `OrderStore` and `OrderDetailsStore`, on sign-out and on a user change.

## Step 2: One source for prices and volumes
5. **One price lookup.** `findBasePrice(prices, product, category)` in `product.util.ts` replaces `computePricesForProduct` and `getExactPrice`.
   - Today they disagree on the matrix fallback and on `size_id` null vs `UNDEFINED`.
   - Discounts and TVA are applied after the lookup.
6. **One volume formula.** `pieceVolumeM3` / `itemVolumeM3` everywhere, with `BOARDS_PER_BUNDLE` instead of a literal `10`.
   - The cart and the order currently compute m³ differently. Keep one rule, documented in SPEC §10.
7. **Inline math into tested helpers:**
   - `order-details.component.ts` (pieces × m2_brut);
   - `order-pdf.component.html` (quantity / thickness);
   - `create-offer-page.component.ts` (pack merge).
8. **Vitest for:** `calculateTotalQuantity`, `calculateM3Quantity`, `pieceVolumeM3`, `calculateM2Price` (NET/BUC/PAC), `findBasePrice`, `mergeDuplicateItems`, and TVA on add.

## Step 3: Safety net
9. **Baseline migration** `20261012000000_baseline.sql`.
   - Idempotent `create table if not exists`, for the base tables that are not in any migration.
   - Recorded as applied, not run.
   - Also: compare the staging and production schemas, and validate the `NOT VALID` `order_items` checks.
10. **SQL test script** in `supabase/tests/`: `place_order` (offer, replace, convert), stock booking per grade, deleted order and restore, `deny_user`.
11. **Magic ids to enums** in templates (`unit_id === 2/3`, `client.type === 1/2`).
12. **Tidy-ups:**
    - Make the `Product` lumber fields `number | null`.
    - Rename `install.service.ts` to `pwa-install.service.ts`.
    - Remove the unused `logo-outline-2.png` and `logo-outline-3.png`.

## Not in this cleanup
- **Server-side price recomputation:** manual discounts are a real feature. The action history covers accountability. Revisit a guard trigger for `operator_id` / `client_id` afterwards.
- **Sidebar model, theme tokens, brand config:** multi-location Phase 1.
- **The SQL "graded" rules:** multi-location Phase 3.
- **Later, low risk:**
  - the `sort_order` `max+1` race;
  - the item status trigger ignores `order_id` changes;
  - `rebook_product` drops a booking when the grade row is missing;
  - splitting `order-details.component.ts` (690 lines).

## Verification
- Unit tests and component specs pass (run from `D:\`).
- Staging run against the regression checklist in [multi-location.md](multi-location.md), plus:
  - TVA client on first add;
  - a product with no price;
  - the same product added three times;
  - sign out and sign in as another user;
  - offer → order keeps m³ and totals.
- The SQL script passes before and after.
- `code-review` on the branch.

## Log
- **2026-11-25:** Audit done (pricing; orders, cart, stock; lumber assumptions). Plan created. Branch `refactor/pre-location` created.
- **2026-11-25: Step 1 done.**
  - **TVA on add:** `selected-product` now uses `effectiveUnitPrice`. The impact was smaller than feared: the overview re-prices every line, so saved prices were already right. Only the price shown on `/offer/create` was too high for a `tva=true` client.
  - **Grade button:** `firstPricedCategory` / `nextCategory` in `product.util` stop after one cycle. A line whose only priced grade is its own is left alone, so a manual price survives.
  - **Merge:** `mergeCartItems` / `mergeDuplicateItems` in `cart.items.ts` sum all duplicates. They also fix a found bug: loose M2 pieces that exactly fill a pack were not turned into a pack (`>` instead of `>=`). The merged line stays manual if either part was. The create page now matches by product id instead of name, re-reads the line when the dialog closes, and no longer edits the cart line in place.
  - **Sign-out:** the cart is emptied and the saved cart removed when the user changes. The saved cart records its owner (`SavedCart.ownerId`), and another user's saved cart is discarded on startup. `ClientStore` clears the chosen client.
  - **Not needed:** `OrderStore.init()` already empties its rows, and `OrderDetailsStore` is per component.
  - **Not done:** no component test for TVA on add. The price comes from the tested `effectiveUnitPrice`.
  - **Docs:** SPEC §9 (cart persistence, cart totals) and the orders/products CLAUDE.md updated. Code review run, findings fixed.
- **2026-11-25: Step 2 done.**
  - **Price lookup:** one rule, `priceRowsForProduct()` / `findBasePrice()` in `product.util`, used by `computePricesForProduct`, `getExactPrice` and `getUsedPrices`. The audit's "the two lookups disagree" was overstated: they differed only on the unit check for a product's own rows. Production and staging data: every product has a size, and no own row has another unit, so behaviour is unchanged. Staging has a leftover general row without a size (id 124, M3/AB 1200) that nothing can match; it is test data and was left alone.
  - **Manual adjustment:** `rowAdjustment()`. A product's own row now wins over the general row, whatever the array order. With no list price the result is 0, no longer NaN.
  - **Volume:**
    - `lineVolumeM3()` (not rounded), `roundM3()` (totals rounded once), `countsInVolumeTotal()`. The cart total and `orderTotals` are tested equal, so an offer turned into an order keeps its m³.
    - The review caught that per-line rounding counts lines under 0.0005 m³ as 0. Now only the total is rounded.
    - On production data the old cart and order formulas differed only in rounding: all bundles have a width, and the 4 M3 products without a width count their quantity either way.
  - **Inline math moved to helpers:** the template volume and m², `m2BrutQuantity` (3 copies), `packsPiecesLabel` (2 copies), and the M3 volume in `calculatePrice` and `unitPriceFromLine`.
  - **Bugs found and fixed:**
    - "Load offer into cart" dropped the M2 pack breakdown, so the order saved empty `packs_pieces`. Now `m2PacksFromQuantity()` rebuilds it, and merges use it too.
    - The cart's usable m² showed a tenth of the real area for lines with only loose pieces, and far too little for lines with only packs. Now `m2NetArea()`.
    - Editing a cart line to quantity 0 wrote into the store's line and later gave a NaN price. It is now refused with a toast, and the store line is no longer mutated.
    - The Step 1 sign-out reset also wiped the same user's cart when a session expired. Now only *another* user signing in empties it.
  - **Tests:** about 30 new Vitest cases (lookup, adjustment, volume, totals, M2 NET/PAC, M2 helpers, merge).
  - **Left as is:**
    - `selected-product` injects `ClientStore` from another feature. The sibling `selected-product-list` already did this; revisit when brand/location config arrives.
    - The review also flagged `supabase/rollbacks/advisor_cleanup_rollback.sql`, already on `develop`: it recreates `products_without_prices()` on staging, where it never existed, without a pinned `search_path`. Look at it in Step 3.
- **2026-11-25: Step 3 done.**
  - **Baseline:** `supabase/schema/baseline.sql`, the database before the first migration, read from production.
    - **Changed from the plan:** it is not a migration recorded as applied. Today's state plus a replay of the migrations would fail, because the migrations change the base tables. And production's migration history stays as it is, so nothing was written to production.
    - It runs in one transaction and refuses to start when `public.orders` exists. The guard was tested on staging.
    - Not yet done: a full replay (baseline, then all migrations) on an empty project, which needs a temporary Supabase branch.
  - **Drift check (staging vs production):**
    - Migration history, policies, triggers, grants, cron and all functions are the same. Two functions differ only in whitespace.
    - Real differences, listed in `supabase/README.md`:
      - text column limits, e.g. `clients.address` is `varchar(100)` on production and unlimited on staging. A longer value saves on staging and fails on production; the longest real value today is 55;
      - `products.width` / `length` precision;
      - a foreign key `profiles` → `auth.users` exists only on staging;
      - `on update cascade` on `order_items.category_id` exists only on production;
      - `handle_new_user()` is slightly different.
    - **Open decision for the owner/user:** align the two with one migration.
  - **`NOT VALID` checks:** both `order_items` checks are already validated on both projects. Nothing to do.
  - **`stocks`:** read-only through the API, as CLAUDE.md says. The insert/update/delete privileges are revoked, even though the policy says "full access". Supabase's default `TRUNCATE` grant remains on every table; it cannot be called through the REST API. Possible later hardening.
  - **SQL tests:** `supabase/tests/order_flow_checks.sql`, 31 checks covering:
    - `place_order` (offer, order, replaced offer, never an order deleted as "the offer");
    - the order item RPCs and their totals;
    - soft delete and restore permissions;
    - mark delivered;
    - the 10-day purge, permanent delete, and `deny_user`.

    All 31 pass on staging, and the run is rolled back.
  - **Rollback script:** `advisor_cleanup_rollback.sql` now has the production-only function in a separate, commented-out block, with a pinned `search_path`.
  - **Magic ids:** 27 template sites and 1 TypeScript site use `Unit_id` / `ClientType`. No numeric unit or client-type comparisons are left in `features/`.
  - **Tidy-ups:**
    - `Product` lumber fields and the order-line product dimensions are now `number | null`. The helpers use `!`, which keeps the exact old arithmetic: a first try with `?? 0` changed `undefined` → NaN into 0.
    - `InstallService` was renamed to `PwaInstallService`.
    - `logo-outline-2.png` and `logo-outline-3.png` were deleted.
  - **The code review on Step 3 found, and these were fixed:**
    - A saved cart with owner `null` was discarded for its real user. Null now means unknown.
    - An M2 merge without `m2_brut` lost the pack breakdown. The two breakdowns are now summed.
    - Own price rows of another unit blocked the general rows. They are now ignored.
    - "Total A / B" could save a merged line at the price of only one of its parts (an older bug). It now re-grades in one pass (`regradeItems`).
    - A grade change kept `manualPrice` (older), so TVA and price changes never reached the line. It is now cleared.
    - The grade button skipped grades whose overview price was 0. It now checks the list price only.
    - `m2FromM3` showed ∞ without a thickness. It now returns 0.
  - **Kept on purpose, in SPEC §9:** when a hand-priced line and a list-priced line merge, the merged line stays hand-priced. Losing a negotiated price is worse than missing an automatic re-price. Revisit if the owner sees it differently.
