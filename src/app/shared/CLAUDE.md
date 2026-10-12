# shared/

Reusable code with no feature affiliation. `shared/` may import from `core/` but never from `features/`.

## components/layout/
Shell components that wrap every page:
- `topbar/` — `mat-toolbar`, `position: fixed` on `:host` (height 56px, z-index 900). Left group: menu toggle + back button. Right group: logo (32px tall) + optional admin badge + language switcher. Emits `sidebarToggle` output; does not manage sidebar state itself.
- `sidebar/` — `position: fixed; top: 56px; height: calc(100vh - 56px)`, z-index 800. Slides in from `left: -280px` → `left: 0` on open. On mobile the backdrop (z-index 799) is shown; on desktop (≥960px) the backdrop is hidden via CSS and `AppComponent` shifts the main content by 280px instead.
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
