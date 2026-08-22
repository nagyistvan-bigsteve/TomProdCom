# features/orders/

Order listing, the multi-step offer creation workflow, and PDF generation.

## components/
- `order-details/` — expanded view of a single order's line items
- `order-table/` — reusable table component used in both orders and offers listings
- `pdf/order-pdf/` — jsPDF render target for printing an order; uses `@shared/utils/order-pdf-generator.util`
- `pdf/pdf-header/` — PDF document header section
- `pdf/pdf-footer/` — PDF document footer section

## pages/ — Offer creation workflow (sequential flow)
```
/offer          → start-page/      (entry; shows recent offers)
/offer/client   → select-client/   (pick a customer)
/offer/create   → create-offer/    (add products, quantities, prices)
/offer/overview → offer-overview/  (review + confirm → saves to DB)
```
State across these steps is held in `store/cart/` and `store/order/`.

## pages/ — Order views
- `orders/` — all confirmed orders
- `offers/` — all offers (not yet confirmed)
- `deleted-orders/` — soft-deleted orders; admin-only restore available

## services/
- `orders.service.ts` — Supabase queries for `orders` and `order_items` tables

## store/
- `cart/cart.store.ts` — line items being built during offer creation; persists to localStorage
- `cart/cart.slice.ts` — cart state shape
- `order/order.slice.ts` — metadata for the current order (client, notes, date)

## Pricing
Unit prices are calculated with helpers from `@shared/utils/product.util`. ClientType (PF/PJ) affects which price tier applies. See `SPEC.md` for the complete pricing matrix.
