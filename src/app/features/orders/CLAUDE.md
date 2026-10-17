# features/orders/

Order listing, the multi-step offer creation workflow, and PDF generation.

## components/

### `order-details/` — single order/offer detail view

Inputs: `@Input({ required: true }) orderId: number`, `@Input() justOffers: boolean`  
Output: `@Output() closeDetails: EventEmitter<void>`

Key capabilities:
- Loads the order and its line items itself (`OrderDetailsStore.load(orderId)`, store provided by the component). All changes go through `OrderDetailsStore` (see store/ below); the component keeps only UI state (add form, inline edit, dialogs).
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
  - `saveEditItem()`: looks up the unit price for the new category from the price table (applying TVA and B-2.5cm adjustments), calls `productUtil.calculatePrice()` using the full product from `catalogStore.productsEntityMap()` (because `OrderItemsResponse.product` is a partial type missing `m2_brut` etc.), then calls `detailsStore.updateItem()`, which saves the item and the new order totals in one transaction.
- **Add product form**: hidden by default, revealed by the "Termék hozzáadása" / "Adaugă produs" toggle button (`showAddForm` signal). Same chip + autocomplete + quantity form as before.
- Dialog has explicit **Save** (`[mat-dialog-close]="true"`) and **Cancel** (`[mat-dialog-close]="false"`) buttons. Comment and voucher are only persisted on Save. Item mutations (add / inline-edit / delete) persist immediately regardless.
- On Save: `detailsStore.saveCommentAndVoucher()` saves comment, voucher and the new `total_amount_final` (`applyVoucher(totalAmount, voucher)`: percentage or fixed amount, never below 0, rounded to 2 decimals) in one request.

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
- Base price per row comes from `calculateActualPrice` (`@shared/utils/product.util`): general rows show the list price (minus TVA); only product-specific rows show the −50 for a 2.5 cm category-B board. Display only — items are priced per item in `getExactPrice()`.
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

**Layout:**
- `:host` uses `flex: 1; min-height: 0; overflow-y: auto` — the whole page scrolls. No `padding-top` hack.
- Standard `.page-header` strip with `NAVBAR.DELETED` title + a count badge (only shown when orders exist).
- `.page-content` has `padding: var(--space-4) var(--space-3)` on mobile, increasing at `sm` and `md`.
- **Orders grid** (`.orders-grid`): single column on mobile/tablet, **two columns** at `lg` (≥1280px).
- **Cards** (`.order-card`): plain `<div>` (not `mat-card`), white background, `border-radius: 12px`, `box-shadow`. The card sets `--mat-icon-color: rgba(0,0,0,0.45)` to override the global white icon theme for white-background cards.
  - Header section (`.card-header`): order ID + days-remaining chip + "deleted N days ago" label.
  - Body section (`.card-body`): detail rows — created date, delivered date (optional), total price, operator (optional). Price row has a top border separator.
  - Actions (`.card-actions`): stacked vertically on mobile, side-by-side at `sm`+. Restore = `mat-stroked-button`, permanent delete = `mat-flat-button` with red styling.

**Days-remaining chip colors** (via `getDaysClass(days: number)`):
| Class | Condition | Appearance |
|---|---|---|
| `days-ok` | > 5 days | Green border/text |
| `days-warn` | 3–5 days | Orange border/text |
| `days-danger` | ≤ 2 days | Red border/text |

> **No `mat-card` or `mat-chip`** — these were removed and replaced with plain styled divs. Do not re-add them.

## services/

- `orders.service.ts` — Supabase queries for `orders` and `order_items`.
- `order.mapper.ts` — `ORDER_SELECT` (the one column list used by every order query) and the pure `mapOrderRow()` row → `OrderResponse` mapper. Add new order columns here, not in the service.

Read methods (`getOrders`, `getDeletedOrders`, `getClientOrders`, `getOrderItemsById`) **error** when Supabase reports a failure — subscribers must pass an `error` handler. `placeOrder()` returns `false` when the order could not be saved; the caller must keep the cart in that case.

**Multi-row writes go through database functions** (one transaction each, SQL in `supabase/migrations/`): `placeOrder()` → `place_order` (order + items), `orderIsDelivered()` → `mark_order_delivered` (all items + delivery date), `permanentlyDeleteOrder()` → `delete_order_permanently` (items + order). Do not replace them with separate `.from(...)` calls. Line-item add / edit / delete in order details → `add_order_item` / `update_order_item` / `delete_order_item` (item + order totals; the totals are computed in the app by `orderTotals()` and passed in).

Key methods: `placeOrder()`, `getOrderById()`, `addOrderItem()` / `updateOrderItem()` / `deleteOrderItem()` (take the new totals), `updateOrderCommentAndVoucher()`, `transformOfferToOrder()`, `orderIsDelivered()`, `orderItemStatusUpdate()`, `setDeletionForOrder()`, `restoreDeletedOrder()`, `permanentlyDeleteOrder()`, `saveAdminSortOrder()` (via RPC).


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

### `order/` — order / offer list (`OrderStore`)

Root store used by `OrderTableComponent`. It owns the loaded rows and everything that decides what the table shows.

- `order.slice.ts` — state shape:

```typescript
{
  tableSortType: 'delivery' | 'creation' | 'admin';
  tableFilterType: 'all' | 'open' | 'closed' | 'expectedToday';
  justOffers: boolean;
  searchText: string;
  dateRangeStart: Date | null;
  dateRangeEnd: Date | null;
}
```

Default: `tableSortType='delivery'`, `tableFilterType='open'`, `justOffers=false`, no search, no date range.

- `order.computed.ts` — pure, unit-tested functions: `filterByStatus`, `filterBySearch`, `filterByDateRange`, `sortOrders`, `selectVisibleOrders` (all of them combined), `orderListStats`, `moveOrder`. **Change filtering or sorting here**, not in the component, and extend `order.computed.vitest.spec.ts`.
- `order.store.ts` — `OrderStore`:
  - `init(justOffers)` — called by the table on creation: resets filter/sort/search/date range to the defaults and loads the rows. The table is recreated every time the user returns from order details, so the list is always fresh.
  - `visibleOrders()` / `stats()` — the filtered and sorted rows and the footer numbers. Status filter, search and date range always apply together.
  - `setFilter`, `setSort`, `setSearchText`, `setDateRange`.
  - `pay(orderId, paidAmount)` and `delete(orderId)` update the row in place on success (no reload, no delay). `delete` hard-deletes offers and soft-deletes orders.
  - `reorder(previousIndex, currentIndex)` — drag-and-drop: shows the new order immediately, saves it through `update_order_sort_orders`, then refreshes the rows in the background.

### `order-details/` — one open order (`OrderDetailsStore`)

Provided by `OrderDetailsComponent` (not root): each opened order gets its own instance.

- `order-details.computed.ts` — pure, unit-tested: `applyVoucher(amount, voucher)`, `itemVolumeM3(item)` (how order details counts an item's m³: M2 items with a pack breakdown 0, items without width their quantity, bundles ×10, rounded to 3 decimals per item), `orderTotals(items, voucher)`.
- `order-details.store.ts` — state `{ order, items }`:
  - `load(orderId)` — order and items together.
  - `addItem` / `updateItem` / `deleteItem` — compute the totals for the item list **after** the change, save item + totals in one database call, then update the order and reload the items. No timers.
  - `setItemStatus`, `saveCommentAndVoucher`, `markDelivered`, `transformToOrder`, `deletePermanently`.

Client history and the deleted-orders page keep their state in the component; they are single-screen lists and do not need a store.

## Selected order in the URL

The open order is the `?orderId=` query parameter of `/orders` and `/offers` (read by the page through router input binding; `parseOrderId()` in `pages/order-id.util.ts`). Selecting a row navigates to `?orderId=…`; closing removes it. A reload keeps the order open and the browser Back button closes it.

From client history the link is `/orders?orderId=…&fromHistory=true`; closing the details then calls `location.back()` and returns to `/clients`.

## Pricing

Unit prices are calculated with helpers from `@shared/utils/product.util`. See SPEC.md §10 for the complete pricing model. The `client.tva` flag (not ClientType) triggers automatic price adjustments for M3 and BUNDLE products.
