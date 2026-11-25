# Cleanup of the lumber code before multi-location

## Goal
Fix real pricing and cart bugs. Reduce the price lookup and the volume math to one tested version each. Build a safety net (baseline schema, SQL tests) before multi-location adds a location to exactly this code. This is a cleanup, not a redesign.

**Branch:** `refactor/pre-location`, off `develop`. It is merged and released on its own, then `feature/instal-location` is rebased on it.
**Order of work:** this cleanup → [action history](action-history.md) → [multi-location](multi-location.md) Phase 1.

## Status

| Step | What | Effort | Status |
|---|---|---|---|
| 1 | Bug fixes: TVA on add, category recursion, cart merge, cart and stores after sign-out | 1.5 days | ✅ Done 2026-11-25 |
| 2 | One price lookup, one volume formula, inline math to tested helpers, Vitest gaps | 1.5 days | Next |
| 3 | Baseline migration, schema drift check, SQL test script, magic ids to enums, small tidy-ups | 1.5–2 days | — |

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
