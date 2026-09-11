# features/admin/

Admin-only functionality: user approval, role management, product management, and price management. All routes (`/settings`, `/deleted`) are protected by `authGuard` with `requiredRole: 'admin'`.

## pages/

### `settings/` — admin configuration shell

Hosts three sections with these tab values (default: `add_product`):

| Tab key | Component shown |
|---------|----------------|
| `add_product` | `AddProductComponent` |
| `update_product` | `UpdateProductsComponent` |
| `price` | `ChangePricesComponent` |

**Responsive layout:**
- Mobile/tablet: full-width `mat-button-toggle-group` tab bar above a scrollable content panel.
- Desktop (≥960px): two-column layout — 220px left side nav (icon + label buttons, hidden on mobile) + scrollable right content panel. The tab bar is hidden via CSS at ≥960px; the side nav is hidden below 960px.

The side nav buttons use plain `<button>` elements styled with `.nav-item` / `.active` classes (no Material button — keeps the style self-contained). Switching tabs sets `settingControl` via `setValue()`.

User and approval management lives on the `/user` page (see `features/auth/`), not here.

## components/

### `add-product/` — create a new product

1. User fills a form: `name`, `unit_id`, `size_id`, `length`, `thickness`, `width`, `m2_brut`, `m2_util`, `piece_per_pack`.
2. On save, calls `ProductStore.addProductAndReturn()` which returns the new product including its generated ID.
3. A price dialog immediately opens so the user can set unit prices for each quality grade (A, AB, B, T).
4. `addPrice()` inserts a `Price2` row for each non-zero price via `ProductStore.addPrice()`.
5. After closing the dialog the form resets ready for another product.

**Form layout:** CSS Grid, `grid-template-columns: 1fr` on mobile → `1fr 1fr` at ≥600px. The `name` field spans both columns on tablet+. All form fields use `appearance="outline"` with MDC dark-background overrides (white text/border on dark green) — no white card wrapper.

### `update-products/` — edit products and stock

Has two modes toggled by an `updateStock: boolean` flag on the component:

**Product edit mode** (`updateStock = false`):
- User selects a product from an autocomplete (`appearance="outline"`).
- Form pre-fills with existing product fields.
- On save, calls `ProductStore.updateProduct()`.

**Stock edit mode** (`updateStock = true`):
- User selects a product and sees the current stock value from `ProductStore.stocksEntityMap()`.
- If a stock row exists: calls `ProductStore.updateStock()`.
- If no stock row yet: calls `ProductStore.addStockAndReturn()`.

**Form layout:** Same CSS Grid pattern as `add-product`. Both share identical SCSS for dark-bg form field MDC overrides and the 2-column grid.

### `change-prices/` — bulk price editor

Manages prices in the `prices_new` table. **Prices are keyed by `unit + size + category`, not by ClientType.** PJ clients with `tva=true` receive automatic price reductions at display/calculation time (see SPEC.md §10.3) — there is no separate PJ price row.

Three editing modes, selected by `selectedPriceType`:

| Mode | Tab label (HU) | Target | `product_id` |
|------|----------------|--------|-------------|
| `unic` | "Egyedi ár" | Browse/edit existing product-specific prices | non-null |
| `m3` | "m³" | Category/size matrix prices | null |
| `new` | "Egyedi beáll." | Set or override a product-specific price for any product | set on save |

**`unic` mode:** Lists all price rows where `product_id` is not null (flat list of product+category combos, searchable). User selects one and edits the price via `changePrice()`.

**`m3` mode:** User picks a category (`A`/`AB`/`B`/`T`) and size (`NORMAL`/`EXTRA`/`EXTRA2`), which filters to the matching base price. Also shows M3 products in that filter range (excluding those that already have `unic` prices) so the user can see what the price applies to.

**`new` mode ("Egyedi beáll."):** Shows **all** products (sorted by name, searchable via `overrideSearch`). This tab is always visible — it is not conditional on `productsWithoutPrices.length`. User picks a category chip, then selects a product. **Smart save logic:**
- `checkExistingUnicPrice()` is called on product-select and on category-change. It looks up `unicPriceList` for an entry matching the selected `product.id + selectedCategory`.
- If a unic price exists → `existingUnicPriceId` is set and `actualPrice` pre-fills with the current value. Saving calls `changePrice({ id: existingUnicPriceId, new_price })` (update, no duplicate inserted).
- If no unic price exists (matrix-covered or truly priceless) → `existingUnicPriceId = null`, `actualPrice = 0`. Saving calls `addPrice()` (new unic row inserted with `product_id = selectedNewProduct.id`).
- After a `addPrice()` save the store effect re-fires, `refreshUnicPriceList()` runs, and `checkExistingUnicPrice()` is re-called automatically to sync the pre-fill state.

**`productsWithoutPrices`:** Still computed (products with no unic price AND no matrix coverage for their `unit_id + size_id`), but no longer drives the tab's visibility or its product list. It can be used for diagnostics.

**`isNewPrice` flag:** tracks whether the price input differs from the stored/pre-filled value; controls the enabled state of the update button.

**Key invariant:** A product is considered "matrix-covered" if any `prices_new` row exists with `product_id = null` and matching `unit_id + size_id`. `refreshProductsWithoutPrices()` builds a `Set` of `${unit_id}_${size_id}` keys from all null-product-id rows and filters products against it. Do not remove this check — without it, all M3 products with matrix prices would incorrectly appear in the priceless list.

### `approve-user/` — new user approval

Lists all users where `approved = false` (fetched via `AuthStore.fetchUnapprovedUsers()`).

- **Approve:** calls `AuthStore.approveUser(id)` → sets `profiles.approved = true`.
- **Deny:** calls `AuthStore.denyUser(id)` → **permanently hard-deletes the user** from Supabase (not soft-delete). The user record is gone.

### `users-list/` — approved users and role management

Lists all approved users (fetched via `AuthStore.fetchUsers()`).

- **Toggle role:** calls `AuthStore.changeRoleForUser(id, oldRole)` which toggles `user` ↔ `admin`.
  - Promoting to admin: also inserts a row into the `admin_users` table.
  - Demoting to user: also deletes the row from `admin_users`.
- An admin cannot accidentally demote themselves without a safeguard (enforced in `AuthStore`).

## Important notes

- Pricing changes in `ChangePricesComponent` propagate immediately to the offer workflow because `ProductStore` is a global singleton that holds the price entities.
- Always consult SPEC.md §10 before modifying price logic — the lookup hierarchy (product-specific vs category matrix) and TVA adjustments are described there.
