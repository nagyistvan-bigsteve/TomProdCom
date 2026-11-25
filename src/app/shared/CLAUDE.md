# shared/

Reusable code with no feature affiliation. `shared/` may import from `core/` but never from `features/`.

## components/layout/
Shell components that wrap every page:
- `topbar/` — `mat-toolbar`, `position: fixed` on `:host` (height 56px, z-index 900). Left group: menu toggle + back button. Right group: logo (32px tall) + optional admin badge + language switcher. Emits `sidebarToggle` output; does not manage sidebar state itself.
- `sidebar/` — `position: fixed; top: 56px; height: calc(100vh - 56px)`, z-index 800. Slides in from `left: -280px` → `left: 0` on open. On mobile the backdrop (z-index 799) is shown; on desktop (≥960px) the backdrop is hidden via CSS and `AppComponent` shifts the main content by 280px instead.
- `language-switcher/` — RO/HU language toggle; state and persistence live in `@core/services/language.service`

Used only in `AppComponent`. Don't import these inside feature components.

## components/dialogs/
Generic confirmation dialogs used across features:
- `confirm-delete-dialog.component.ts` — asks "are you sure?" before a delete
- `confirm-restore-dialog.component.ts` — asks "are you sure?" before a restore

Both are opened via Angular Material `MatDialog`. Pass data in via `MAT_DIALOG_DATA`.

## directives/
- `decimal-input.directive.ts` — formats numeric inputs as decimals with comma/dot normalization; applied to price and quantity fields

## pipes/
- `app-date.pipe.ts` — `| appDate`, `| appDate: 'dateTime'`, `| appDate: 'short'`: dates in the current UI language's format (RO `24.11.2026`, HU `2026.11.24`). Impure so it follows a language switch. Use it instead of `date: '...'` in templates.
- `money.pipe.ts` — `| money`: whole amounts without decimals (`960`), with cents two decimals (`2.155,50`).

## utils/
Pure utility functions and helper services:
- `filter.util.ts` — product/stock list filtering helpers
- `notification.service.ts` — wraps `MatSnackBar` for app-wide toast notifications
- `order-pdf-generator.util.ts` — builds jsPDF documents from order data (used by the orders feature)
- `product.util.ts` — price calculation helpers for M2/M3/BUC/BUNDLE unit conversions
- `stock.util.ts` — graded stock rules (pure, Vitest-covered): `stockCategoryFor()` (T → A, > 7 m → AB, M2 untracked; mirrors SQL `stock_category_for`), `stockCategoriesOf()`, `availableStock()`, `groupStocksByProduct()`, `validateSorting()` / `sortingLimit()` (AB stock, and the truck remainder when sorting from a truck), `bookedAbShortfall()` (ordered AB pieces a sorting takes; warning only), `hasVolume()` (M3 / bundle: shown and summed in m³), `shipmentTotalM3()`, `countsWholePieces()` (BUC, bundle, M3 with a width: stock in whole pieces; mirrors `set_stock`), `m3InputAllowed()` / `piecesFromM3()` (stock typed in m³ on truck lines and the products page stock edit → nearest whole pieces; only pieces are stored)
- `product.util.ts` also exports the single versions of the pricing and volume rules (Vitest-covered; never re-implement them in a component or template):
  - `priceRowsForProduct()` / `findBasePrice()` — price lookup, SPEC §10.1 (own rows, else unit + size matrix; no fallback);
  - `rowAdjustment()` — the overview's manual adjustment for a line (product row before general row);
  - `nextCategory()` / `firstPricedCategory()` — the cart grade button cycle (stops after one round);
  - `pieceVolumeM3()` (one piece, a bundle = 10 boards), `lineVolumeM3()` (a line, rounded to 3 decimals; no width → quantity is m³), `countsInVolumeTotal()` (not M2 / BUC);
  - `m2BrutQuantity()`, `m2FromM3()`, `packsPiecesLabel()` ("3p + 2b").
- `display-format.util.ts` — pure, Vitest-covered: `dateFormatFor(language, kind)`, `datePickerLocale(language)`, `moneyDigits(value)`; used by the pipes above
- `date-picker-locale.ts` — `syncDatePickerLocale()`: call in the constructor of a component that provides a date adapter, so its date picker follows the UI language
- `app-date-adapter.ts` — `provideAppDateAdapter()`: use it instead of `provideNativeDateAdapter()`. `AppDateAdapter` reads typed dates with `parseTypedDate()` in the picker locale's order instead of the browser's month-first `Date.parse`
- `typed-date.util.ts` — pure, Vitest-covered: `parseTypedDate(text, yearFirst)` (ISO `2026-12-01` year first in any language; null for empty, invalid Date for a day that does not exist), `validDateOrNull()`, `isYearFirstLocale()`
