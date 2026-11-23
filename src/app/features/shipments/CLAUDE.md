# features/shipments/

Truck deliveries ("kamion"). A truck's goods enter stock as **AB** as soon as it is validated, because the A/B split is only known after sorting. Business rules: SPEC.md §12 "Truck intake" and "Sorting". Replaces the removed `coming-wares` feature.

Any approved user registers, validates and deletes trucks and records sortings (RLS: `private.is_approved()`).

## Workflow

1. `/shipments/new` → draft: date, truck / supplier name, comment, lines (product + pieces). M2 products are not offered. The page shows the total pieces and m³ (`shipmentTotalM3`).
2. **Save** → `save_shipment` RPC (creates or replaces the draft and its lines; same product lines are summed). A new draft navigates to `/shipments/:id`.
3. **Validate** → confirm → save (so exactly what is on screen is validated) → `validate_shipment` RPC: status `validated`, pieces added to AB, once. Read-only afterwards.
4. Validated truck: per line received / sorted / remaining (`shipmentProgress`), a Sort button per gradable line (opens `SortingDialogComponent` from `@features/products` with the shipment id), and the sortings history with undo (`delete_sorting`).

## Files

- `pages/shipments/` — list with a Draft / Validated toggle; cards show date, name, lines, pieces, m³ and sorted % (validated).
- `pages/shipment-detail/` — draft editor or validated view, chosen by `isDraft()`. Route input `id` (`withComponentInputBinding`): a number or `new`.
- `services/shipments.service.ts` — list (with `shipment_items` and `stock_sortings` embedded), one shipment, and the three RPCs. Failures return `null` / `false`; the central toast names them (`SA003` = already validated).
- `store/shipment.store.ts` — root signal store: `status`, `shipments`, `current`, `sortings`, `withBusy()`. Loads on page open (not on sign-in). Reloads `ProductStore` stock after validate and undo.
- `shipment.util.ts` — pure helpers (draft lines → items, trailing empty line, progress, sorted %), tested in `shipment.util.vitest.spec.ts`.

Sorting itself (dialog, `SortingsService`) lives in `features/products/` because that feature owns stock.
