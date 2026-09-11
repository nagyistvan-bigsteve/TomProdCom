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

**Layout:**
- Fixed `.detail-header` strip: back button + client name + date + print/edit icon buttons.
- Scrollable `.detail-body` (requires `min-height: 0` for `overflow-y: auto` to work inside a flex column).
- Inner `.detail-layout` wrapper handles arrangement (not the scroll container itself):
  - **Mobile** (`< 960px`): flex column — items card → `right-col` (client info card + action buttons).
  - **Desktop** (`≥ 960px`): CSS Grid `"items right"`, two columns (1fr + 320px). `items-section` is the left column; `.right-col` (client card + actions together) is the right column. Grouping client + actions in one div prevents empty space between them when the items list is long.
- `:host` uses `flex: 1; min-height: 0; overflow: hidden`; `:host` of parent (`orders/` page) must also have `min-height: 0` or the child cannot constrain its height.

**Card design (`.detail-card`):**
- Both the items section and the client/info section render inside white rounded cards (`border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.18)`).
- **Items card:** each line item uses `.item-row` (flex, `justify-content: space-between`) with `.item-row-divider` (bottom border) between rows. Left: `.item-name-cat` (product name + category as two-line column). Right: `.item-right` (quantity on top, price below, right-aligned). Total appears in `.total-row` at the bottom of the card.
- **Client card:** each detail row uses `.info-row` with a small Material icon (`.info-row-icon`, 18px), an optional label chip (`.info-row-label`), and the value (`.info-row-value`). Phone and delivery address rows are `.clickable` (tap-to-call / open-in-maps).
- **Action buttons:** `.primary-action-btn` (dark red `rgba(95,1,1,…)`, 48px full-width flat) for delivered/transform; `.secondary-action-btn` (white-border stroked, 44px) for the load-into-cart transform.

**Icon color overrides:**
The global `mat.icon-overrides(color: white)` in `styles.scss` makes all icons white by default (correct for the dark app shell). Inside the white dialog, this must be overridden per icon:
- `.dialog-icon-dark` — `rgba(0,0,0,0.54)` for neutral actions (close, edit).
- `.dialog-icon-danger` — `rgb(134,2,2)` (app red) for the delete action.

**Edit dialog:**
- Opens with `maxHeight: '95vh'` to prevent overflow on small screens. The `mat-dialog-content` uses `max-height: calc(90vh - 130px)` via `::ng-deep` to bound the scrollable area while leaving room for the title bar and action row.
- Edits `orderComment` (comment) and `orderVoucher` (discount code/amount, e.g. `10%` or `500`).
- **Item list** (`.edit-order-popup-list`): each row shows `[name–category] [qty] [edit] [delete(red)]`. Edit and delete save immediately to the DB — they do not wait for the dialog's Save button.
- **Inline item editing:** clicking the pencil button opens `.item-inline-edit` (dark panel, same background as add form) replacing that row. Shows category chips (populated from `computePricesForProduct` — does NOT mutate `selectedProductId` in the store) and a quantity input. ✓ saves via `saveEditItem()`, ✗ cancels. Opening inline edit closes the add form if it was open.
  - `saveEditItem()`: looks up the unit price for the new category from the price table (applying TVA and B-2.5cm adjustments), calls `productUtil.calculatePrice()` using the full product from `catalogStore.productsEntityMap()` (because `OrderItemsResponse.product` is a partial type missing `m2_brut` etc.), then calls `editOrderItem()` and recalculates totals via `getUpdateOrderTotals()` after a 250 ms settle.
- **Add product form**: hidden by default, revealed by the "Termék hozzáadása" / "Adaugă produs" toggle button (`showAddForm` signal). Same chip + autocomplete + quantity form as before.
- Dialog has explicit **Save** (`[mat-dialog-close]="true"`) and **Cancel** (`[mat-dialog-close]="false"`) buttons. Comment and voucher are only persisted on Save. Item mutations (add / inline-edit / delete) persist immediately regardless.
- On Save: calls `OrdersService.updateOrderVoucherAndTotal()` which recalculates `total_amount_final` from `totalAmount` using the new voucher and clamps to `Math.max(0, result)` (never negative). Updates the in-memory `order` object immediately.

### `order-table/` — reusable table for orders and offers

Input: `@Input() justOffers: boolean` (adjusts column labels and delete behavior)  
Outputs: `@Output() orderOutput`, `@Output() isLoading`

**Layout:**
- `:host` is `flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden`.
- `.controls-panel` (`flex-shrink: 0`): filter tabs + sort button + single search field + date range picker.
- `.table-body` (`flex: 1; min-height: 0; overflow-y: auto; overflow-x: auto`): the scrollable table region. Has horizontal padding (`var(--space-3)` mobile, `var(--space-6)` desktop) to give the table breathing room from screen edges.

**Filtering (`tableFilter`):**

| Value | Shows |
|-------|-------|
| `all` | Everything |
| `open` | `date_order_delivered = null` |
| `closed` | `date_order_delivered` is set |
| `expectedToday` | `expectedDelivery` matches today's exact calendar date (`getDate()`) AND not yet delivered |

Filter status is rendered as a `mat-button-toggle-group` (hidden on the offers page since `justOffers=true`).

> **Bug history:** the `expectedToday` filter previously used `getDay()` (day of week 0–6) instead of `getDate()` (day of month 1–31), so orders on the same weekday in different weeks incorrectly matched.

**Sorting (`tableSort`):**

| Value | Sort key |
|-------|----------|
| `delivery` | `expected_delivery` date |
| `creation` | `date_order_placed` |
| `admin` | `sort_order` (manual drag-and-drop position) |

Secondary sort within any mode: "for first hour" flag → "until delivery date" flag.  
Sort is chosen via a `mat-menu` dropdown triggered by a sort icon button.

**Drag-and-drop sort:** Enabled only when the current user is `admin` AND `tableSort === 'admin'`. Uses Angular CDK Drag-Drop. New order is persisted via the Supabase RPC `update_order_sort_orders`.

**Delete behavior:**
- Offers (`justOffers=true`) → **permanent hard-delete**.
- Orders (`justOffers=false`) → **soft-delete** (sets `deleted_at`).

**Text search:** Single `searchFilter` FormControl. Matches client name **or** delivery address (case- and diacritic-insensitive). Previously there were two separate fields (name / address); merged into one unified search.

**Responsive columns:**
- Mobile (`< 600px`): DELIVERY_PLACE column hidden — shown instead in the expanded row detail.
- Small (`< 768px`): QUANTITY column also hidden — shown in the expanded row detail.

**Expanded row detail:** clicking a row expands a detail panel showing: date placed, address (mobile), quantity (small), voucher, delivered date, paid amount, operator name, comment. Uses a 3-level CSS grid trick:
1. `.row-expand-wrapper` — `display: grid; grid-template-rows: 0fr/1fr; overflow: hidden` (no padding, no background).
2. `.row-expand-inner` — `min-height: 0; overflow: hidden` (direct grid child, no padding).
3. `.row-expand-content` — actual padding and `background: #f4f4f4`.
The `td.expand-detail-td` cell must have `padding: 0 !important` to prevent the cell's own padding from preventing collapse.

> **Scoping note:** `::ng-deep tr.detail-row { height: 0 }` is required (not just `tr.detail-row { height: 0 }`) because Angular Material creates table `<tr>` elements through its own `ViewContainerRef` and they may not receive the component's `_ngcontent` attribute, making scoped CSS ineffective.

**Payment:** `payOrder()` opens a dialog to record a partial/full payment; updates `paid_amount` via `OrdersService.orderIsPaid()`.

**Subscription hygiene:** both `searchFilter.valueChanges` and `dateRange.valueChanges` must use `takeUntilDestroyed(this.destroyRef)`. Without it, navigating between orders and offers recreates the component but leaves the old subscription alive, causing stale callbacks to fire on the new instance.

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

Key methods: `placeOrder()`, `transformOfferToOrder()`, `orderIsDelivered()`, `orderItemStatusUpdate()`, `setDeletionForOrder()`, `restoreDeletedOrder()`, `permanentlyDeleteOrder()`, `saveAdminSortOrder()` (via RPC), `updateOrderComment()`, `updateOrderVoucherAndTotal()`.

**`updateOrderVoucherAndTotal(id, voucher, totalAmountFinal)`** — saves `voucher` and `total_amount_final` together in one update. Always call this when editing a voucher (not just `updateOrderComment`) so the displayed price stays in sync. The caller (`order-details`) computes `totalAmountFinal` via `calculateFinalPriceWithVoucher(totalAmount, voucher)` which applies percentage or fixed-amount discount and clamps to `Math.max(0, result)`.

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
