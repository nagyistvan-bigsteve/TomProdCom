-- New prices for several line items of one order / offer, in one transaction
-- together with the order totals. Used by the price dialog in order details
-- (e.g. a new m³ price for every category A board of an offer).
--
-- p_items: [{ "id": <order_items.id>, "price": <new line total> }, ...]
-- The app computes the line totals and the order totals, as for
-- update_order_item. Every item must belong to p_order_id; otherwise nothing
-- is changed.
--
-- Run after order_item_functions.sql (uses private.set_order_totals).

create or replace function public.update_order_item_prices(
  p_order_id integer,
  p_items jsonb,
  p_totals jsonb
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_expected integer := jsonb_array_length(p_items);
  v_updated integer;
begin
  update public.order_items oi
  set price = x.price
  from jsonb_to_recordset(p_items) as x(id integer, price numeric)
  where oi.id = x.id
    and oi.order_id = p_order_id;

  get diagnostics v_updated = row_count;

  if v_updated <> v_expected then
    raise exception 'Expected to update % items of order %, updated %',
      v_expected, p_order_id, v_updated
      using errcode = 'P0002';
  end if;

  perform private.set_order_totals(p_order_id, p_totals);
end;
$$;

revoke execute on function public.update_order_item_prices(integer, jsonb, jsonb)
from public, anon;

grant execute on function public.update_order_item_prices(integer, jsonb, jsonb)
to authenticated;
