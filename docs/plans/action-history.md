# Action history (audit log)

## Goal
Admins can see **who did what and when**: orders and offers created, changed, deleted or restored; clients, products, prices and stock changed; users approved or given a role. This is useful today, and more so with two locations.

## Status

| Phase | What | Effort | Status |
|---|---|---|---|
| A1 | Database: `audit_log` table, triggers, RLS, retention | 1.5–2 days | Planned |
| A2 | Admin page `/history`: list, filters, readable sentences | 1.5–2 days | Planned |
| A3 | Location-aware entries (after multi-location Phase 2) | 0.5 day | Waiting |

Total: about 3–5 days.

**Branch:** `feature/action-history`, off `develop`. It does not depend on the multi-location feature, so it can ship first. Entries recorded from day one then also cover the location rollout.

## What exists today
- `orders.operator_id`: who created the order.
- `shipments.created_by` and `validated_by`, `stock_sortings.created_by`.
- `stock_adjustments`: hand stock edits with old and new values and `created_by`.
- Nothing records edits, deletions, restores, price changes, client changes or user approvals.

## Design

### Table `public.audit_log`
| Column | Notes |
|---|---|
| `id bigint generated always as identity` | |
| `occurred_at timestamptz not null default now()` | |
| `actor_id uuid` → `profiles(id) on delete set null` | `auth.uid()`; null for system jobs (pg_cron) |
| `tx_id bigint not null default txid_current()` | Groups all rows of one action (an order plus its items) into **one line** in the UI |
| `entity text not null` | `order`, `offer`, `client`, `product`, `price`, `stock`, `shipment`, `sorting`, `user` |
| `entity_id text not null` | For child rows, the parent: an order item logs under its order |
| `action text not null` | `create`, `update`, `delete`, `soft_delete`, `restore`, `approve`, `deny`, `role_change`, `convert`, `validate`, `stock_set` |
| `changes jsonb` | Only the changed fields: `{"price": [12.5, 13]}` |
| `context jsonb` | A readable snapshot (order number, client name), so the entry still makes sense after the row is deleted |
| `location_id smallint` | Nullable. Filled from Phase A3 on |

Indexes: `(occurred_at desc)`, `(entity, entity_id, occurred_at desc)`, `(actor_id, occurred_at desc)`.

### How rows are written
- One `security definer` trigger function, `private.write_audit()` (`search_path = public`), runs `after insert/update/delete` on:
  - `orders` and `order_items`;
  - `clients` and `client_phones`;
  - `products` and `prices_new`;
  - `shipments` and `stock_sortings`;
  - `stock_adjustments`;
  - `profiles` (`approved`, `role`) and `admin_users`.
- Triggers mean no write path can forget to log, including RPCs and future code.
- **`stocks` is not audited directly.** Bookings change it all the time. Stock history comes from the order, shipment, sorting and `stock_adjustments` entries instead.
- The trigger derives `action` from the change. For example, `orders.deleted_at` going from null to a date is `soft_delete`, and back is `restore`. `just_offer` going from true to false is `convert`.
- Columns that change only as a side effect (`sort_order`, computed totals) are left out of `changes`, so the log does not fill up with noise.

### Security
- RLS: **select for `private.is_admin()` only**. There are no insert, update or delete policies.
- Revoke `insert, update, delete` from `anon` and `authenticated`. Only the definer trigger writes, so history cannot be edited from the app.
- Retention: a pg_cron job deletes entries older than N months. N is an owner question; default 24.

### Admin page (A2)
- `features/admin/pages/history/`: lazy route `/history`, admin guard, sidebar entry.
- `HistoryService` → `HistoryStore` (`withBusy`). Server-side paging (keyset on `occurred_at, id`).
- Filters: user, entity type, date range, location (after A3). Entries are grouped by `tx_id`.
- Each entry is a sentence built from i18n keys (`HISTORY.ORDER.SOFT_DELETE` …) in `ro.json` and `hu.json`. The changed fields show as old → new.
- Later: a "History" tab in order details, client details and product admin, filtered to that entity.
- Pure helpers (sentence building, field diff display) get Vitest tests.

### Location (A3)
- After multi-location Phase 2, the trigger fills `location_id`: from the row itself, or from its parent order or product.

## Open questions for the owner
1. How long should history be kept (1 year, 2 years, forever)?
2. Should normal users see their own history, or admins only?
3. Is anything missing from the list above (for example PDF downloads or sign-ins)? Viewing is **not** logged by default.

## Log
- **2026-11-25:** Plan created.
