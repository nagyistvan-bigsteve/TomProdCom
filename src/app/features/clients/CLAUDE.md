# features/clients/

Client (customer) management. Clients are referenced by the orders/offer workflow.

## components/
- `add-client/` — dialog form to create a new client; validates Romanian CUI (via `@core/guards/cuiValidator`)
- `client-details/` — shows the selected client's address and type badge; used in the offer sidebar
- `client-history/` — list of past orders for a client, loaded on demand

## pages/
- `clients/` — searchable/filterable client list; opens `add-client` dialog

## services/
- `client.service.ts` — Supabase CRUD for the `clients` table; returns RxJS Observables

## store/
NgRX Signals store for the currently selected client (persists across the offer workflow):
- `client.store.ts` — main store with `withBusy` feature
- `client.slice.ts` — state shape interface
- `client.updaters.ts` — pure updater functions

## ClientType rules
- `PF` (Persoana Fizica — individual): no CUI required
- `PJ` (Persoana Juridica — company): CUI validation required; different price tier applies

See `SPEC.md` for the full pricing matrix by ClientType.
