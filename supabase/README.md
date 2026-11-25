# supabase/

| Folder | What |
|---|---|
| `migrations/` | Every schema change since 2026-10-13, applied to staging and production in filename order. Both projects record exactly these versions (`list_migrations`). |
| `schema/baseline.sql` | The database **before** the first migration (the tables made by hand in the dashboard). Not a migration. |
| `rollbacks/` | Emergency undo scripts, one per migration, run by hand in reverse order. |
| `tests/` | Check scripts for staging. They roll everything back and report as an error message. |

## Rebuilding the database
To rebuild on a new, empty Supabase project:
1. Run `schema/baseline.sql`. It refuses to run when `public.orders` already exists.
2. Run every file in `migrations/`, in filename order.

The baseline was written from production on 2026-11-25 and its guard was tested on staging. The full replay (baseline, then all migrations) has not been run on an empty project yet. A temporary Supabase branch would do it.

## Tests (run on staging, never on production)

| Script | Covers |
|---|---|
| `tests/graded_stock_checks.sql` | Graded stock (A/AB/B, T from A, > 7 m, M2), trucks, sortings, offer → order booking, hand stock edits, API read-only tables |
| `tests/order_flow_checks.sql` | `place_order` (offer, order, replaced offer), order item RPCs and totals, soft delete / restore permissions, mark delivered, 10-day purge, permanent delete, `deny_user` |

How to run a test:
- Paste the script into the SQL editor, or run it through the Supabase MCP `execute_sql`.
- The "error" message is the report. Every line must start with `ok`.
- Run the scripts before and after changing any function they touch.

## Known differences between staging and production (2026-11-25)
The migration history, functions, policies, triggers, grants and the cron job are the same on both projects. The differences come from the base tables having been made by hand:

| Object | Production | Staging | Effect |
|---|---|---|---|
| `clients.name`, `address`, `code`; `client_type.name` | `varchar(100)` | `varchar` (no limit) | A client field over 100 characters saves on staging but **fails on production**. The form has no limit; the longest real value today is 55 characters. |
| `clients.other_details` | `varchar(1000)` | `varchar` | Same, at 1000 characters. |
| `units.name`, `sizes.name`, `categories.name` | `varchar(50)` | `varchar` | None (fixed lookup rows). |
| `products.width`, `length` | `numeric(10,2)` | `numeric` | Production rounds dimensions to 2 decimals. |
| `order_items.category_id` foreign key | `on update cascade` | plain | None: category ids never change. |
| `profiles.id` foreign key to `auth.users` | missing | present | Production can keep a profile whose sign-in account was removed outside the app. |
| `handle_new_user()` | inserts id, email, name | also sets role and approved, `on conflict do nothing` | Same result for a normal sign-up. |

These are not fixed yet. One small migration could align them; it is the owner's decision. Plan: `docs/plans/pre-location-cleanup.md`.
