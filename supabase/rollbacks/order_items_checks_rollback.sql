-- Emergency undo of migrations/20261124130100_order_items_checks.sql.

begin;

alter table public.order_items
  drop constraint if exists order_items_quantity_positive,
  drop constraint if exists order_items_price_not_negative;

commit;
