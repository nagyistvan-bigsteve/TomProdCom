-- Order items must have a positive quantity and a price of 0 or more.
--
-- Until now place_order / add_order_item / update_order_item accepted any
-- number, so an item of -5 pieces could be saved; on an order it lowered
-- booked_stock and showed more free stock than there is.
--
-- The constraints are added NOT VALID: new and changed rows are checked at
-- once, existing rows are left alone. They are validated right away when no
-- existing row breaks them; otherwise the rows are listed in a notice, and
-- after fixing them run:
--   alter table public.order_items validate constraint order_items_quantity_positive;
--   alter table public.order_items validate constraint order_items_price_not_negative;
--
-- Undo with supabase/rollbacks/order_items_checks_rollback.sql.

alter table public.order_items
  drop constraint if exists order_items_quantity_positive,
  drop constraint if exists order_items_price_not_negative;

alter table public.order_items
  add constraint order_items_quantity_positive check (quantity > 0) not valid,
  add constraint order_items_price_not_negative check (price >= 0) not valid;

do $$
declare
  v_bad text;
begin
  select string_agg(format('item %s (order %s): quantity %s, price %s', id, order_id, quantity, price), '; ')
  into v_bad
  from public.order_items
  where quantity <= 0 or price < 0;

  if v_bad is null then
    alter table public.order_items validate constraint order_items_quantity_positive;
    alter table public.order_items validate constraint order_items_price_not_negative;
  else
    raise notice 'order_items checks left NOT VALID, fix these rows first: %', v_bad;
  end if;
end;
$$;
