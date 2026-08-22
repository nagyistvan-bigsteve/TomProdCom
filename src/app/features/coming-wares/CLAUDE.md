# features/coming-wares/

Tracks incoming stock shipments before they are received and verified.

## components/
- `coming-wares-details/` — detailed view of a single incoming shipment; shows line items and verification status
- `create-coming-wares/` — dialog to register a new incoming shipment with product and quantity entries

## pages/
- `coming-wares.component` — list of all pending incoming shipments; routes to details via `/coming-wares/:id/:verified`

Route params:
- `:id` — shipment ID
- `:verified` — boolean flag; `true` means the shipment has been received and stock has been updated

## services/
- `coming-wares.service.ts` — Supabase queries for the `coming_wares` and `coming_wares_items` tables

## Domain notes
When a shipment is verified, stock quantities in the `stocks` table are incremented. This logic lives in the service; consult `SPEC.md` for the stock update rules.
