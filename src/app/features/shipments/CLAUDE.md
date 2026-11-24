# features/shipments/

Truck deliveries ("kamion"). A truck's goods enter stock as **AB** as soon as it is validated, because the A/B split is only known after sorting. Business rules: SPEC.md §12 "Truck intake" and "Sorting". Replaces the removed `coming-wares` feature.

Any approved user registers, validates and deletes trucks and records sortings. The tables are **read-only through the API** (select policy `private.is_approved()`); every write goes through the `security definer` RPCs, which check approval and set `created_by` / `validated_by` themselves (`20261123180000_graded_stock_hardening.sql`). Never write these tables with `.from(...).insert/update/delete`.

## Workflow

1. **`/shipments/new` → draft.**
   - Fields: date, truck / supplier name, comment, and lines (product + pieces). M2 products are not offered.
   - The page shows the total pieces and m³ (`shipmentTotalM3`: M3 and bundle products only).
   - A line of an `m3InputAllowed()` product can be typed in m³ (suffix button `.on-dark-unit-btn`). `m3Text` keeps the typed text per line key; `line.quantity` always holds the converted pieces (`piecesFromM3`), so save, fingerprint and backup see pieces only. After a reload the line is back in pieces.
   - Under the form, `missingForSave()` says what still stops a save. The buttons are disabled with a reason, never silently.
2. **Save** → `save_shipment` RPC. It creates or replaces the draft and its lines, and lines of the same product are summed.
   - The header sends the draft's `updated_at`. If someone else saved meanwhile, the RPC raises `SA007`, the store reloads the draft and the central toast says so.
   - The page then asks (`resolveConflict`): load their version (`takeTheirs`, the form refills) or keep the user's edits (the form is left alone; the next save carries the new version and replaces theirs). The fill effect never refills a dirty form on a reload of the same draft by itself.
   - After a successful save the store reloads the draft to get its new version.
   - A new draft navigates to `/shipments/:id`.
3. **Validate** → confirm → quiet save (so exactly what is on screen is validated, with one toast) → `validate_shipment` RPC. The status becomes `validated` and the pieces are added to AB, once. Read-only afterwards.
4. **Validated truck:**
   - per line received / sorted / remaining (`shipmentProgress`);
   - a Sort button per gradable line, which opens `SortingDialogComponent` from `@features/products` with the shipment id and the line's remaining pieces. It is disabled until the sortings have loaded (`sortingsLoaded`) and once nothing is left;
   - the sortings history, showing who sorted, with undo (`delete_sorting`);
   - the sortings are reloaded on **every** dialog close;
   - a sorting from a truck can never take more than is left on it (`record_sorting` raises `SA005`);
   - who registered and who validated the truck: `creator` / `validator`, embedded from `profiles`.

**Unsaved changes.** `draftFingerprint()` of the form is compared with the one taken when it was last loaded or saved (`dirty()`).
- `unsavedDraftGuard` (`canDeactivate` on `/shipments/:id`) asks before leaving a dirty draft, whether by Back, the menu or Cancel.
- An unsaved **new** truck is kept in localStorage (`shipment_draft_new`, wrapped in try/catch). On `/shipments/new` the page offers it back through `ConfirmRestoreDialogComponent`, so a reload (e.g. the forced reload on deploy) does not lose it.

**Layout of the validated lines:** not a table. Each `.progress-row` is a grid: on mobile the product name and Sort button on top and the three numbers (`<dl class="progress-stats">`, label above value) below; from `sm` one line (name · numbers · button). A 5-column table did not fit a phone (headers overlapped, the button was cut off). Product names wrap (`overflow-wrap: anywhere`); the dimensions are at the end of the name and must not be cut off.

**Styles:** page header, content width, dark fields and buttons, secondary text and stock colours are the global dark-page helpers in `styles.scss` (`.dark-page-header`, `.dark-page-title`, `.dark-page-content`, `.on-dark-field`, `.on-dark-stroked`, `.on-dark-secondary`, `.stock-*`). The component SCSS keeps only what is specific to the page; the 4 kB budget is tight.

## Files

- `pages/shipments/` — the list.
  - A Draft / Validated toggle that clears the list when switched, a search by name, and a "to sort" chip on the validated tab (`filterShipmentCards`).
  - The cards are `<a routerLink>` and show date, name, lines, pieces, m³ and sorted % (`role="progressbar"`). "–" means nothing to sort.
  - It loads 50 trucks at a time with "load more".
- `pages/shipment-detail/` — draft editor or validated view, chosen by `isDraft()`. Route input `id` (`withComponentInputBinding`): a number or `new`. `unsaved-draft.guard.ts` lives here.
- `services/shipments.service.ts` — list pages (`range`, `SHIPMENTS_PAGE_SIZE`), one shipment with `creator` / `validator` names, and the three RPCs. `saveShipment` returns `{ id, code }` so the store can tell `SA007` apart. The central toast names the failures.
- `store/shipment.store.ts` — root signal store.
  - State: `status`, `shipments`, `page` / `hasMore` / `listFailed`, `current`, `sortings`, `sortingsLoaded` / `sortingsFailed`, plus `withBusy()`.
  - Loads on page open, not on sign-in, and resets itself when the signed-in user changes.
  - A reload of the current shipment keeps it on screen until the new version arrives.
  - Reloads `ProductStore` stock after validate and undo.
- `shipment.util.ts` — pure helpers: draft lines → items, trailing empty line, progress, sorted % (`null` = nothing to sort), cards and list filter, draft fingerprint, missing fields, and localStorage backup parse/serialise. Tested in `shipment.util.vitest.spec.ts`.

Sorting itself (dialog, `SortingsService`) lives in `features/products/` because that feature owns stock.
