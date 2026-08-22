# features/products/

Product catalog, stock levels, and pricing data.

## components/

### `product-list/` — filterable product catalogue

Used on the `/products` page and embedded inside the offer creation flow (`/offer/create`). Displays products with their current stock and allows filtering/searching.

### `selected-product/` — single cart line-item builder

Shows one product selected for an offer line item. Lets the user enter quantity, choose the quantity input mode for M2 products (BRUT / NET / BUC / PAC), and set the quality category (A / AB / B / T).

### `selected-product-list/` — cart line-item list

The running list of products added to the current offer cart.

**Important behaviors:**
- On every load, `compareSavedPrice()` compares each item's saved price against the current price from `ProductStore`. If the price table has changed since the cart was last saved, the cart item price is silently updated.
- `getExactPrice()` implements the full price-lookup hierarchy: product-specific price first, then size/category matrix. Also applies TVA adjustment (`client.tva=true` → M3 −100, BUNDLE −5) and any manual discounts from the offer-overview page.
- Emits `@Output() pricesOutput: EventEmitter<Price2[]>` so the offer-overview page knows which price rows are in use.
- `getTotalPriceInA()` / `getTotalPriceInB()` compute hypothetical totals at category A and B prices — displayed as reference prices during cart review.

### `overwrite-dialog/` — cart duplicate confirmation

Opened by `create-offer-page` when the user adds a product+category combination that already exists in the cart.

Two choices:
- **Overwrite** — replaces the existing item with the new one.
- **Add / Merge** — sums quantities and prices; for M2 items, recalculates pack overflow if combined extra pieces exceed a full pack.

## pages/

### `products/` — main product catalogue page

Inventory tool (not just a catalogue). Stock information is prominent. Admins can also edit product details and stock directly from this page.

## services/

- `products.service.ts` — Supabase queries for the `products` table.
- `prices.service.ts` — Supabase queries for the **`prices_new`** table (not `prices`). The price matrix is keyed by `unit_id + size_id + category_id`, or by `product_id + unit_id + category_id` for product-specific overrides. There is no PF/PJ column in this table.
- `stocks.service.ts` — Supabase queries for the `stocks` table. Uses a **real-time Supabase subscription** so stock values update live across all connected clients without requiring a page reload.

## store/

NgRX Signals entity store. Loaded once on app start; shared by offer workflow, admin settings, and order-details.

- `product.store.ts` — main store; merges `products`, `prices_new`, and `stocks` data into `ProductWithStock` entities; exposes `addToProductStock()` (called by coming-wares on verification)
- `product.slice.ts` — state shape
- `product.computed.ts` — derived signals including filtered product lists and category-level price totals

## Key domain types

- `Unit_id`: `BUC` (1, pieces) | `M2` (2, square metres) | `M3` (3, cubic metres) | `BUNDLE` (4, bundles — spelled `BOUNDLE` in the enum)
- `Category`: `A` (1, premium) | `AB` (2, standard) | `B` (3, board/secondary) | `T` (4, treated/impregnated)
- `Size_id`: `NORMAL` (0) | `EXTRA` (1) | `EXTRA2` (2) | `UNDEFINED` (3)

Price calculation depends on unit type. See `@shared/utils/product.util` and SPEC.md §10 for the complete formulas, M2 quantity modes, and TVA adjustment rules.
