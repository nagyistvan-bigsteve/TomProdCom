# shared/

Reusable code with no feature affiliation. `shared/` may import from `core/` but never from `features/`.

## components/layout/
Shell components that wrap every page:
- `topbar/` — top navigation bar with menu toggle and language switcher trigger
- `sidebar/` — slide-in navigation menu with route links and role-based visibility
- `language-swicher/` — RO/HU language toggle; persists selection to localStorage

Used only in `AppComponent`. Don't import these inside feature components.

## components/dialogs/
Generic confirmation dialogs used across features:
- `confirm-delete-dialog.component.ts` — asks "are you sure?" before a delete
- `confirm-restore-dialog.component.ts` — asks "are you sure?" before a restore

Both are opened via Angular Material `MatDialog`. Pass data in via `MAT_DIALOG_DATA`.

## directives/
- `decimal-input.directive.ts` — formats numeric inputs as decimals with comma/dot normalization; applied to price and quantity fields

## utils/
Pure utility functions and helper services:
- `filter.util.ts` — product/stock list filtering helpers
- `notification.service.ts` — wraps `MatSnackBar` for app-wide toast notifications
- `order-pdf-generator.util.ts` — builds jsPDF documents from order data (used by the orders feature)
- `product.util.ts` — price calculation helpers for M2/M3/BUC/BUNDLE unit conversions
