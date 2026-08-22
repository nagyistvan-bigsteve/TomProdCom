# features/admin/

Admin-only functionality: user approval, role management, product management, and price management. All routes (`/settings`, `/deleted`) are protected by `authGuard` with `requiredRole: 'admin'`.

## pages/

### `settings/` — admin configuration shell

Hosts three sections in a button-toggle tab group with these tab values:

| Tab key | Component shown |
|---------|----------------|
| `add_product` | `AddProductComponent` |
| `update_product` | `UpdateProductsComponent` |
| `price` | `ChangePricesComponent` |

User and approval management lives on the `/user` page (see `features/auth/`), not here.

## components/

### `add-product/` — create a new product

1. User fills a form: `name`, `unit_id`, `size_id`, `length`, `thickness`, `width`, `m2_brut`, `m2_util`, `piece_per_pack`.
2. On save, calls `ProductStore.addProductAndReturn()` which returns the new product including its generated ID.
3. A price dialog immediately opens so the user can set unit prices for each quality grade (A, AB, B, T).
4. `addPrice()` inserts a `Price2` row for each non-zero price via `ProductStore.addPrice()`.
5. After closing the dialog the form resets ready for another product.

### `update-products/` — edit products and stock

Has two modes toggled by an `updateStock: boolean` flag on the component:

**Product edit mode** (`updateStock = false`):
- User selects a product from an autocomplete.
- Form pre-fills with existing product fields.
- On save, calls `ProductStore.updateProduct()`.

**Stock edit mode** (`updateStock = true`):
- User selects a product and sees the current stock value from `ProductStore.stocksEntityMap()`.
- If a stock row exists: calls `ProductStore.updateStock()`.
- If no stock row yet: calls `ProductStore.addStockAndReturn()`.

### `change-prices/` — bulk price editor

Manages prices in the `prices_new` table. **Prices are keyed by `unit + size + category`, not by ClientType.** PJ clients with `tva=true` receive automatic price reductions at display/calculation time (see SPEC.md §10.3) — there is no separate PJ price row.

Three editing modes, selected by `selectedPriceType`:

| Mode | Target | `product_id` |
|------|--------|-------------|
| `unic` | Product-specific prices | non-null |
| `m3` | Category/size matrix prices | null |
| `new` | Products that have no price at all | set on save |

**`unic` mode:** Lists all price rows where `product_id` is not null. User selects one from the list and edits the value.

**`m3` mode:** User picks a category (`A`/`AB`/`B`/`T`) and size (`NORMAL`/`EXTRA`/`EXTRA2`), which filters to the matching base price. Also shows M3 products in that filter range (excluding those that already have `unic` prices) so the user can see what the price applies to.

**`new` mode:** Lists products that have zero price rows. User selects a product and enters its first price, which is then inserted via `ProductStore.addPrice()`.

`isNewPrice` flag tracks whether the entered value differs from the stored value before saving.

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
