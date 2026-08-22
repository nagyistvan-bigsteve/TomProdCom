# features/coming-wares/

Tracks incoming stock shipments (goods ordered from a supplier but not yet received). Lets employees register expected shipments, inspect items on arrival, and selectively increment stock.

## Domain concepts

### Shipment (`ComingWares`)

A shipment has:
- `expected_delivery` — the expected arrival date
- `name` — optional label for the shipment
- `total_quantity` — total units across all line items
- `all_for_order` — convenience flag: when `true`, ALL items in this shipment default to `for_order=true`
- `comment` — general notes
- `verified` — whether the shipment has been received and inspected

### Shipment item (`ComingWaresItem`)

Each line in a shipment:
- `product_id`, `category` — which product and quality grade
- `quantity` — how many units
- `for_order` (bool) — **this item is reserved for a specific customer, NOT for general stock**
- `is_correct` (3-state) — inspection verdict: `null` = not yet checked, `true` = correct/good, `false` = defective/wrong
- `comment` — required when `is_correct = false` (inspector notes on defect)

### `for_order` vs stock

- `for_order = false` (for stock): on verification, if `is_correct = true`, stock is incremented.
- `for_order = true` (reserved for a customer order): **stock is never incremented**. These items are informational only — the employee physically sets them aside and hands them to the customer directly. There is no automatic order or stock link.

Only admins can create new shipments.

## components/

### `create-coming-wares/` — new shipment dialog

Form captures: `expected_delivery`, `name`, `comment`, `all_for_order`, and an `items` FormArray.

Each item row has: product (autocomplete), category, quantity, `for_order` checkbox.

- When `all_for_order` is checked, the per-item `for_order` checkbox is disabled; the page forces all items to `for_order=true` before saving.
- `maybeAddNewItem()` auto-adds an empty row when the user fills the last one.
- On save, the dialog returns the form value to the page via `dialogRef.close(value)`.

### `coming-wares-details/` — shipment inspection view

Shows the full item list split into two groups:
- **For Order** (`for_order = true`) — read-only display only; not eligible for stock increment
- **For Stock** (`for_order = false`) — items that will increment stock if verified as correct

**Inspection workflow:**

1. Employee taps each item to cycle `is_correct`: `null` → `true` → `false` → `null`.
2. If cycled to `false` (defective), a comment dialog opens immediately; comment is required before saving.
3. The **Submit/Verify button is disabled** until every item has a non-null `is_correct` verdict.
4. On submit (verify):
   - The shipment is marked `verified = true` via `ComingWaresService.verifyComingWares()`.
   - For each item where `for_order = false AND is_correct = true`: `productStore.addToProductStock(product.id, quantity)` is called directly from the component (not from the service).
   - Navigates back to the list.

**Verified shipments are fully read-only.** All interaction buttons are hidden/disabled.

## pages/

### `coming-wares.component` — shipment list

- Default view shows pending (not verified) shipments.
- Toggle button switches to verified shipments.
- Only admins see the "Create" button.
- Route to details: `/coming-wares/:id/:verified` (`:verified` route param is a boolean string reflecting the current tab).

## services/

- `coming-wares.service.ts` — Supabase CRUD for `coming_wares` and `coming_wares_items`.
- `verifyComingWares(id)` — sets `verified = true` in the DB; does NOT touch stock (stock is updated by the component, not the service).
- `itemIsCorrect(id, isCorrect)` — persists the per-item verdict.
- `addCommentOnItem(id, comment)` — persists the defect comment.
- `deleteComingWares(id)` — deletes items first, then the parent shipment.
