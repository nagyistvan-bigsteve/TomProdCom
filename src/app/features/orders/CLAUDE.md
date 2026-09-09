# features/orders/

Order listing, the multi-step offer creation workflow, and PDF generation.

## components/

### `order-details/` — single order/offer detail view

Inputs: `@Input() order: OrderResponse`, `@Input() justOffers: boolean`  
Output: `@Output() closeDetails: EventEmitter<void>`

Key capabilities:
- Fetches order line items on init (`OrdersService.getOrderItemsById()`).
- Add / edit / delete line items; recalculates totals after each change.
- `item_status` per line item: `false` = pending, `true` = delivered. Can be toggled individually.
- Print PDF via `OrderPdfGeneratorUtil`.
- Mark entire order delivered: sets `date_order_delivered` and flips all `item_status` to `true`.
- **Offer → Order transformation (two variants):**
  1. *Load into cart:* reads items from DB, loads them into `CartStore`, sets the client in `ClientStore`, navigates to `/offer/overview` so the user can review/change before confirming.
  2. *Direct transform:* calls `OrdersService.transformOfferToOrder()` which sets `just_offer = false` in the DB immediately — no changes possible.

### `order-table/` — reusable table for orders and offers

Input: `@Input() justOffers: boolean` (adjusts column labels and delete behavior)  
Outputs: `@Output() orderOutput`, `@Output() isLoading`

**Filtering (`tableFilterType`):**

| Value | Shows |
|-------|-------|
| `all` | Everything |
| `open` | `date_order_delivered = null` |
| `closed` | `date_order_delivered` is set |
| `expectedToday` | Expected today AND not yet delivered |

**Sorting (`tableSortType`):**

| Value | Sort key |
|-------|----------|
| `delivery` | `expected_delivery` date |
| `creation` | `date_order_placed` |
| `admin` | `sort_order` (manual drag-and-drop position) |

Secondary sort within any mode: "for first hour" flag → "until delivery date" flag.

**Drag-and-drop sort:** Enabled only when the current user is `admin` AND `tableSortType === 'admin'`. Uses Angular CDK Drag-Drop. New order is persisted via the Supabase RPC `update_order_sort_orders`.

**Delete behavior:**
- Offers (`justOffers=true`) → **permanent hard-delete**.
- Orders (`justOffers=false`) → **soft-delete** (sets `deleted_at`).

**Text search:** case- and diacritic-insensitive; matches against client name or delivery address.

**Payment:** `payOrder()` opens a dialog to record a partial/full payment; updates `paid_amount` via `OrdersService.orderIsPaid()`.

### `pdf/order-pdf/`, `pdf/pdf-header/`, `pdf/pdf-footer/`

jsPDF render targets. Invoked from `order-details` via `@shared/utils/order-pdf-generator.util`. Not used standalone.

## pages/ — Offer creation workflow

Sequential flow — state persists via `CartStore` (localStorage) across all steps:

```
/offer          → start-page/      navigation buttons only (→ /offer/create, → /products)
/offer/create   → create-offer/    (step 1) add products, set quantities and categories → builds CartStore
/offer/client   → select-client/   (step 2) pick a customer → sets ClientStore
/offer/overview → offer-overview/  (step 3) review pricing, set delivery details → saves to DB
```

> The route listing above reflects the actual workflow order: **products first, then client**. The route `/offer/client` appears alphabetically before `/offer/create` but is visited second. See SPEC.md §9 for the canonical workflow diagram.
>
> Note: the `/offer` start route name is a misnomer — this is really a landing/start page. It may be renamed to `/landing` or `/start` in a future refactor.

### `start-page/`

Two `mat-flat-button` / `mat-stroked-button` actions: "Create Offer" (→ `/offer/create`) and "Products" (→ `/products`).  
**Layout:** mobile — single column, max-width 480px; desktop (≥960px) — two-column: image left, buttons right (max-width 900px).

### `select-client/`

Autocomplete over all clients (from `ClientStore`). Selecting a client calls `ClientStore.setClientId()`. The selected client persists in the store for the rest of the workflow.

Embeds `AddClientComponent` with `[withoutForwardButton]="true"` — the page owns the Continue navigation via its own animated bottom bar that appears once a client is selected.

**Layout:**
- Page header strip: back button (→ `/offer/create`) + title + `2 / 3` step chip.
- **Mobile** (`< 960px`): vertical stack — autocomplete search field at top, `add-client` form below, animated Continue bar slides in at the bottom once a client is selected.
- **Desktop** (`≥ 960px`): two-column row — search panel fixed at `flex: 0 0 360px` left, `add-client` form fills remaining right column with `overflow-y: auto`. Continue bar is right-aligned (200px width).

### `create-offer/`

Product selection and cart building. Calls into `CartStore` for all mutations.

**Responsive layout:**
- **Mobile** (`< 960px`): two panels (product-panel, cart-panel) toggle via a fixed red `mat-fab` (bottom-right). While on the product panel a "mini-cart bar" at the panel bottom shows all cart items (name · category · quantity) and the running total; tapping it switches to the cart panel.
- **Desktop** (`≥ 960px`): both panels side-by-side (`flex: 1` each) with a divider. Toggle FAB is hidden. The `isDesktop` signal is derived from `BreakpointObserver('(min-width: 960px)')`.

Cart panel has `padding-bottom: 88px` on mobile to keep the last rows scrollable above the fixed FAB (56px FAB + 24px offset + 8px breathing room).

Duplicate handling: if the same `(category + product.name)` is already in the cart, an `OverwriteDialogComponent` opens:
- "Overwrite" → replaces the item.
- "Add/Merge" → sums quantity and price; recalculates pack-piece overflow for M2 items.

### `offer-overview/`

Final review before saving.

**Layout:**
- Page header strip: back button (→ `/offer/client`) + title (`OVERVIEW_PAGE.TITLE`) + `3 / 3` step chip.
- `:host` is `overflow-y: auto`; `.offer-page-container` is `max-width: 960px; margin: 0 auto` on desktop. No `vh`/`vw` units.
- **Mobile** (`< 960px`): single-column grid, DOM order — prices accordion, client info, product list, discount + confirm.
- **Desktop** (`≥ 960px`): CSS Grid two-column. `grid-template-areas: "pl pr" "pl cl" "pl bo"` — product list (`pl`) fills the left column spanning all rows; right column (360px) stacks prices (`pr`), client (`cl`), and discount/confirm (`bo`) top-to-bottom. The DOM order is preserved for correct mobile rendering without needing CSS `order` overrides.

Key features:
- Receives price rows from `SelectedProductListComponent` via `@Output() pricesOutput`.
- `isAllPriceDifferent` toggle: when on, expands aggregate category prices into per-product price rows so individual products can have different prices.
- Manual discount: `setFinalPrice(index, finalPrice)` stores the difference as `discount` on the price row; this discount is applied back in `SelectedProductListComponent.getExactPrice()`.
- TVA auto-comment: if `client.tva = true`, prepends `"Taxare inversa - fără TVA\n"` to the comment.
- Delivery fee appended to comment as `"Transport: N RON\n"`.
- On confirm: calls `OrdersService.placeOrder()`, clears cart, resets client, navigates to `/orders` (order) or `/offers` (offer).

**`justOffer` flag:** controls whether the saved record is an offer (`just_offer=true`) or order (`just_offer=false`). Set by toggling the "just offer" checkbox before confirming.

### `orders/` and `offers/`

Both use `OrderTableComponent` with `justOffers` set accordingly.

### `deleted-orders/`

Admin-only view of soft-deleted orders.
- On load, auto-purges orders where `deleted_at` is more than **10 days** ago (`DAYS_UNTIL_PERMANENT_DELETE = 10`) via `OrdersService.permanentlyDeleteOrder()`.
- Shows a countdown (`daysUntilDelete`) for each order.
- Restore: `restoreDeletedOrder()` sets `deleted_at = null`.
- Permanent delete: `permanentlyDeleteOrder()` hard-deletes the order and its items.

## services/

- `orders.service.ts` — Supabase queries for `orders` and `order_items`.

Key methods: `placeOrder()`, `transformOfferToOrder()`, `orderIsDelivered()`, `orderItemStatusUpdate()`, `setDeletionForOrder()`, `restoreDeletedOrder()`, `permanentlyDeleteOrder()`, `saveAdminSortOrder()` (via RPC).

## store/

### `cart/cart.store.ts` — offer line-item state

Persists to `localStorage` with key `product_items_data`.

**Stale data handling (10-minute TTL):**
- On init, if saved data is older than `STALE_THRESHOLD_MS` (10 min):
  - If current route is an offer-creation page → shows `ConfirmRestoreDialogComponent` asking whether to restore or discard.
  - If on the offers listing page → auto-clears the stale data silently.

Key methods:
- `addProductItem()` — **prepends** new items (newest first in the list).
- `updateProductItem(productId, category, updates)` — finds by `(productId + category)` pair.
- `checkForDuplicatedItems()` — merges exact duplicates by summing quantity and price.
- `cartTotal()` — computed signal; sums all `item.price`.
- All mutations call `persistState()` to write to localStorage.

### `order/order.slice.ts` — order list UI state

```typescript
{
  currentOrderId: number;          // -1 = nothing selected
  tableSortType: 'delivery' | 'creation' | 'admin';
  tableFilterType: 'all' | 'open' | 'closed' | 'expectedToday';
  justOffers: boolean;
}
```

Default: `tableSortType='delivery'`, `tableFilterType='open'`, `justOffers=false`.

## fromHistory navigation

When a user clicks an order in `client-history`, the component:
1. Saves the order to `localStorage` under key `on-order-details-page`.
2. Navigates to `/orders?fromHistory=true`.

The orders page reads the localStorage key, skips the table view, and opens order details for that order directly. When the user presses back/close in the detail view, `location.back()` takes them to `/clients` (not the orders table).

## Pricing

Unit prices are calculated with helpers from `@shared/utils/product.util`. See SPEC.md §10 for the complete pricing model. The `client.tva` flag (not ClientType) triggers automatic price adjustments for M3 and BUNDLE products.
