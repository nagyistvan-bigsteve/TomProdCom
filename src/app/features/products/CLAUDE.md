# features/products/

Product catalog, stock levels, and pricing data.

## components/

### `product-list/` — filterable product catalogue

Used on the `/products` page and embedded inside the offer creation flow (`/offer/create`). Displays products with their current stock and allows filtering/searching.

### `selected-product/` — single cart line-item builder

Shows one product selected for an offer line item. Lets the user enter quantity, choose the quantity input mode for M2 products (BRUT / NET / BUC / PAC), and set the quality category (A / AB / B / T). Below it: total / available stock of the grade the item will deduct from (`stockCategoryFor`; e.g. "(A)" for T), red when available is negative. No extra "T is taken from A" text (removed on request; the grade label says it).

**Add button:** full-width `mat-flat-button` with `add_shopping_cart` icon, app-red background (`rgb(134, 2, 2)`). Styled via `--mdc-filled-button-container-color` / `--mdc-filled-button-label-text-color` CSS custom properties in the component SCSS (no `!important`).

### `selected-product-list/` — cart line-item list

The running list of products added to the current offer cart.

**Important behaviors:**
- On every load, `compareSavedPrice()` compares each item's saved price against the current price from `ProductStore`. If the price table has changed since the cart was last saved, the cart item price is silently updated.
- `getExactPrice()` implements the full price-lookup hierarchy: product-specific price first, then size/category matrix. Also applies TVA adjustment (`client.tva=true` → M3 −100, BUNDLE −5) and any manual discounts from the offer-overview page.
- Emits `@Output() pricesOutput: EventEmitter<Price2[]>` so the offer-overview page knows which price rows are in use.
- `getTotalPriceInA()` / `getTotalPriceInB()` compute hypothetical totals at category A and B prices — displayed as reference prices during cart review.

**Layout constraints (`isInOverview` flag):**
- The root div's `h-100` and `justify-content-evenly` classes are **only applied when `!isInOverview`** (i.e., in the create-offer cart panel). In overview mode these are omitted to prevent the single-child accordion from being vertically centred inside the element, which would create an empty gap above the product list.
- The `.limited-height` class (`max-height: 42.5vh; overflow: auto`) is applied to the accordion when `isInOverview` is true. On desktop (`≥ 960px`) this constraint is lifted via a breakpoint override so the product list expands naturally in its grid column.

### `sorting-dialog/` — AB → A / B / waste

Opened from a validated truck (`data: { product, shipmentId, truckRemaining }`) or from the products page (`data: { product }`).
- **From a truck** it shows and counts down what is left of the product on that truck (`fromTruck()`).
- **From the products page** it counts against the whole AB stock. It also loads `SortingsService.trucksWithRemaining(productId)` (RPC `shipments_with_remaining`) and offers an optional truck `mat-select`. Picking a truck switches to that truck's remainder and sends its `shipmentId`.

How the dialog behaves:
- **Rest to A:** fills up to `sortingLimit()`, the smaller of AB stock and the truck remainder.
- **Inputs:** A / B / waste start empty (`null`, counted as 0), select their content on focus, and A has `cdkFocusInitial`.
- **Validation:** `validateSorting(abStock, input, truckRemaining)`, the same checks as the `record_sorting` RPC (`MORE_THAN_TRUCK` ↔ `SA005`, `MORE_THAN_AB` ↔ `SA001`).
- **Booked AB pieces:** taking them is allowed. `bookedAbShortfall()` drives a non-blocking warning with AB free after the sorting.
- **Saving:** `dialogRef.disableClose` is set and Cancel is ignored while saving. It saves through `SortingsService`, reloads stock and closes with `true`. Callers must refresh on any close, not only on `true`.

### `overwrite-dialog/` — cart duplicate confirmation

Opened by `create-offer-page` when the user adds a product+category combination that already exists in the cart.

Two choices:
- **Overwrite** — replaces the existing item with the new one.
- **Add / Merge** — sums quantities and prices; for M2 items, recalculates pack overflow if combined extra pieces exceed a full pack.

## pages/

### `products/` — main product catalogue page

Inventory tool (not just a catalogue). Stock information is prominent. Admins can edit stock values inline directly from this page.

**Layout:**
- `:host` is `flex: 1; min-height: 0; overflow: hidden` — internal elements own scrolling, no `vh` units.
- Page header strip (title + sort icon button) at the top, `flex-shrink: 0`.
- `.page-body` is `flex: 1; min-height: 0`, centered to `max-width: 960px` on desktop (`@include md`).
- `.controls-row` (search field + sort button) is `flex-shrink: 0` inside `.page-body`.
- `.product-list` is `flex: 1; min-height: 0; overflow-y: auto` — this is the scroll container.

**Product grid:** `.product-list` uses CSS Grid:
- Mobile: 1 column
- `@include sm` (≥600px): 2 columns
- `@include md` (≥960px): 3 columns

Product cards use `background: rgba(0,0,0,0.15)` with `border-radius: 8px`. Hovering darkens to `rgba(0,0,0,0.25)`. Active edit state uses `rgba(0,0,0,0.3)` with a brighter border.

**Card = grade table:** one row per stock grade the product has (A, B, AB; products longer than 7 m only AB; M2 products are not listed) with total, available and m³ (M3 / bundle products), plus a Σ row. Cards are built in `ProductsComponent.cards()` (`ProductStockCard`).

**Filter chips:** all · to sort (gradable product with AB > 0) · shortage (any negative available). Sorting by total stock toggles asc/desc.

**Inline stock edit:** the edit icon (48px touch target) reveals one field per grade and a `mat-mini-fab` save button via `@enterAndLeaveAnimation`.
- Only changed grades are saved (`stockChanges()`), each with the value it had when the edit opened (`editBaseline`). They go through `ProductStore.setStocks()` → `set_stock`, with one toast.
- On `SA006` ("changed meanwhile") the stock is reloaded, the typed values are dropped and the edit stays open with the new numbers.
- The fields use `.on-dark-field` and select their content on focus.

**Empty page:** the spinner shows only while `isBusy()`. Otherwise it shows "no products", or a load error (`loadFailed`) with a retry.

**Sorting:** the "Sort" button (gradable product with AB stock) opens `SortingDialogComponent`.

**Stock colors:** `rgb(141, 216, 27)` (total stock) / `rgb(251, 255, 17)` (available = total − booked) / `rgb(255, 120, 120)` (negative available: more ordered than held — allowed, shown as a warning).

The page calls `fetchStocks()` when it opens, because there is no realtime subscription. The stock colours and dark-page helpers (`.stock-good/-warning/-negative`, `.dark-page-header`, `.on-dark-*`) are global in `styles.scss`.

## services/

- `products.service.ts` — Supabase queries for the `products` table.
- `prices.service.ts` — Supabase queries for the **`prices_new`** table (not `prices`). The price matrix is keyed by `unit_id + size_id + category_id`, or by `product_id + unit_id + category_id` for product-specific overrides. There is no PF/PJ column in this table.
- `stocks.service.ts` — Supabase queries for the `stocks` table (one row per product and grade A / B / AB; rows are created by the `products_stock_rows` database trigger, never by the app). There is **no real-time subscription**. Stock is loaded:
  - when a user signs in;
  - when the products page or the create-offer page opens;
  - when the app comes back to the foreground (`visibilitychange`, at most every 30 s, in `ProductStore`);
  - after a truck validation or a sorting.

  Hand edits go through `setStockObs(id, expected, stock)` → RPC `set_stock` (`SA006` when changed meanwhile; logged in `stock_adjustments`). The app never writes `stocks` directly.
- `sortings.service.ts` — the `record_sorting` / `delete_sorting` RPCs (AB → A / B / waste, and undo), the sortings of a shipment (with `sorter` name), and `trucksWithRemaining(productId)`.

## store/

NgRX Signals entity store. Loaded once on app start; shared by offer workflow, admin settings, and order-details.

- `product.store.ts` — main store with `products`, `prices_new` and `stocks` collections. Stocks are keyed by **stocks row id**; use `stocksByProduct()[productId][Category.A | AB | B]` to read a product's grades. `setStocks(changes)` saves one or more grades (`{ id, expected, stock }`) one after the other and resolves `'saved' | 'conflict' | 'failed'`; on `'conflict'` it has already started a stock reload. `loadFailed` is set when products or stock fail to load. The fetch methods sit in the first `withMethods` block so later methods can call `fetchStocks()`.
- `product.slice.ts` — state shape
- `product.computed.ts` — derived signals including filtered product lists and category-level price totals

## Key domain types

- `Unit_id`: `BUC` (1, pieces) | `M2` (2, square metres) | `M3` (3, cubic metres) | `BUNDLE` (4, bundles — spelled `BOUNDLE` in the enum)
- `Category`: `A` (1, premium) | `AB` (2, unsorted A+B) | `B` (3, board/secondary) | `T` (4, terrace — priced as T, stock taken from A)
- Stock grades: `StockCategory` = A | AB | B. Which grade an item uses: `stockCategoryFor()` in `@shared/utils/stock.util` (SPEC.md §6.5).
- `Size_id`: `NORMAL` (0) | `EXTRA` (1) | `EXTRA2` (2) | `UNDEFINED` (3)

Price calculation depends on unit type. See `@shared/utils/product.util` and SPEC.md §10 for the complete formulas, M2 quantity modes, and TVA adjustment rules.
