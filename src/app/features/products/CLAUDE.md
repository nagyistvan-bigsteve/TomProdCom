# features/products/

Product catalog, stock levels, and pricing data.

## components/
- `product-list/` — filterable list of all products; used on the `/products` page and inside the offer creation flow
- `selected-product/` — shows one product selected for an offer line item; lets user enter quantity
- `selected-product-list/` — the running list of products added to the current offer cart
- `overwrite-dialog/` — dialog shown when a product already exists in the cart; confirms overwriting vs merging

## pages/
- `products/` — the main product catalog page (admin can also edit from here)

## services/
- `products.service.ts` — Supabase queries for the `products` table
- `prices.service.ts` — queries the `prices` table (PF/PJ × Category matrix)
- `stocks.service.ts` — queries the `stocks` table; real-time subscription for live stock updates

## store/
NgRX Signals entity store for products + prices + stocks:
- `product.store.ts` — main store; merges product, price, and stock data into `ProductWithStock` entities
- `product.slice.ts` — state shape
- `product.computed.ts` — derived signals (filtered lists, category totals)

## Key domain types
- `Unit_id`: `BUC` (pieces) | `M2` | `M3` | `BUNDLE`
- `Category`: `A` | `AB` | `B` | `T`
- `Size`: `NORMAL` | `EXTRA` | `EXTRA2` | `UNDEFINED`

Price calculation depends on unit type — M2/M3 products multiply by area/volume, BUC is per-piece. See `@shared/utils/product.util` and `SPEC.md`.
