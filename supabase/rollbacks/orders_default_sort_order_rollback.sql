-- Emergency undo of migrations/20261125120000_orders_default_sort_order.sql:
-- new orders get no sort position again. The positions the migration gave to
-- existing rows stay (they cannot be told apart from dragged ones, and the
-- app handles any number).

begin;

drop trigger if exists orders_default_sort_order on public.orders;

commit;
