# features/clients/

Client (customer) management. The selected client is held in `ClientStore` and persists across the offer workflow.

## components/

### `add-client/` — create or edit a client

Used both as a standalone dialog and as an embedded form in the offer workflow.

- `@Input() withoutForwardButton: boolean` — hides the "continue to offer" navigation button when true (used in standalone context).
- Form groups: `name`, `type` (PF/PJ), `address`, `delivery_address`, `code`, `other_details`, plus a `phones` FormArray.
- Validation:
  - PF clients: `code` must be exactly 13 digits.
  - PJ clients: `code` must pass `cuiValidator()` (Romanian CUI format), unless the "foreign client" mode is enabled.
  - Phone: pattern allows international formats.
  - `code` must be unique (validated async via `uniqueClientCodeValidator()`).
- When `clientStore.isClientSelected()` is true on init, the form pre-fills with the selected client's data (edit mode).
- `addOrUpdateClient()`: if no client is selected → calls `clientStore.addClient()` which inserts the client AND auto-selects it; otherwise calls `clientStore.updateClient()`.
- TVA checkbox: only enabled/visible for PJ clients. Its value feeds into `client.tva`.

### `client-details/` — read-only client summary widget

Shows the selected client's name, type badge (PF/PJ), code, address, phones, and other details.

Used as an inline sidebar in the offer workflow (`/offer/overview`). Has a "Change" button that navigates to `/offer/client` so the user can swap the selected customer.

### `client-history/` — past orders for a client

Fetches and displays past orders for the currently selected client via `OrdersService.getClientOrders(clientId)` on each `clientStore.client()` change.

**Navigation when an order is clicked:**
1. Saves the order ID to `localStorage` under the key `on-order-details-page`.
2. Navigates to `/orders?fromHistory=true`.
3. The orders page reads the localStorage key, skips the table view, and opens order details for that order directly.
4. When the user dismisses the detail view, `location.back()` returns them to `/clients` (instead of showing the orders table, which is the default back behavior).

## pages/

### `clients/` — main client list

- Searchable autocomplete filters clients by name (diacritic-insensitive).
- `selectClient(client)` calls `clientStore.setClientId(client.id)`.
- `showClientHistory` and `showClientDetails` signals toggle the detail panels below the list.

## services/

- `client.service.ts` — Supabase CRUD for `clients` + `client_phones` tables; returns RxJS Observables.

**Phone update strategy:** full-replace — when updating a client, the service **deletes all existing phone rows** and re-inserts the new array. There are no partial updates.

## store/

NgRX Signals store. Persists the selected client across the offer workflow.

- `client.store.ts` — main store with entity collection and `withBusy`
- `client.slice.ts` — state shape (`currentClientId: number`, `-1` = nothing selected)
- `client.updaters.ts` — pure `updateCurrentClientId()` updater

**Key computed signals:**

| Signal | Returns |
|--------|---------|
| `client()` | Full `Client` object for the current selection, or undefined |
| `isClientSelected()` | `true` if `currentClientId !== -1` |
| `isClientPJ()` | `true` if selected client type is PJ (2) |

## Client type and pricing

Client type (`PF` / `PJ`) alone does not change prices. What triggers price adjustments is the `tva` boolean on a PJ client:

- `tva = true` → reverse-charge VAT ("Taxare inversă fără TVA"); triggers price reductions for M3 (−100 RON/m³) and BUNDLE (−5 RON/bundle) products.
- `tva = false` or client is PF → no automatic adjustment.

See SPEC.md §10.3 for the exact TVA discount amounts and SPEC.md §6.2 for the full client field description.

## Address fields

Clients have two address fields (both in the database; `delivery_address` is currently missing from the TypeScript `Client` model — tracked in SPEC.md §6.2):

- `address` — billing / main address
- `delivery_address` — physical delivery location (may differ from billing address for PJ clients)
