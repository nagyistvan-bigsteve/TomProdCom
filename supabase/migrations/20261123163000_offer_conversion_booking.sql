-- Offer <-> order conversion moves stock, and a truck sorting is capped at
-- what is left of that product on the truck.
--
-- 1. Offer items are not booked (the order_items triggers skip offers). Until
--    now, turning an offer into an order only flipped orders.just_offer, so
--    its items were never booked; delivering them later removed a booking
--    that did not exist and booked_stock went negative. A trigger on
--    orders.just_offer now applies every item's effect when an offer becomes
--    an order (undelivered: booked_stock += quantity, delivered: stock -=
--    quantity) and removes it when an admin turns an order back into an offer.
-- 2. booked_stock is recomputed once to repair the numbers already wrong.
-- 3. record_sorting with a shipment refuses to sort more pieces of a product
--    than that truck brought minus what was already sorted from it (SA005).
--
-- Run after 20261123152149_graded_stock.sql. Undo with
-- supabase/rollbacks/offer_conversion_booking_rollback.sql.

-- One item's stock effect, without the "is the order real" check.
create or replace function private.item_stock_effect(
  p_product_id integer,
  p_category_id integer,
  p_quantity numeric,
  p_delivered boolean,
  p_sign integer
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_grade integer := public.stock_category_for(p_product_id, p_category_id);
  v_qty numeric := coalesce(p_quantity, 0) * p_sign;
begin
  if v_grade is null then
    return;
  end if;

  if coalesce(p_delivered, false) then
    perform private.adjust_stock(p_product_id, v_grade, -v_qty, 0);
  else
    perform private.adjust_stock(p_product_id, v_grade, 0, v_qty);
  end if;
end;
$$;

revoke execute on function private.item_stock_effect(integer, integer, numeric, boolean, integer) from public, anon;
grant execute on function private.item_stock_effect(integer, integer, numeric, boolean, integer) to authenticated, service_role;

create or replace function private.trg_order_offer_conversion()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_sign integer := case when coalesce(new.just_offer, false) then -1 else 1 end;
  r record;
begin
  -- fixed order keeps concurrent conversions from deadlocking on stocks rows
  for r in
    select product_id, category_id, quantity, item_status
    from public.order_items
    where order_id = new.id
    order by product_id, id
  loop
    perform private.item_stock_effect(
      r.product_id, r.category_id, r.quantity, r.item_status, v_sign);
  end loop;

  return null;
end;
$$;

revoke execute on function private.trg_order_offer_conversion() from public, anon;
grant execute on function private.trg_order_offer_conversion() to authenticated, service_role;

drop trigger if exists orders_offer_conversion_stock on public.orders;

create trigger orders_offer_conversion_stock
  after update of just_offer on public.orders
  for each row
  when (coalesce(old.just_offer, false) is distinct from coalesce(new.just_offer, false))
  execute function private.trg_order_offer_conversion();

-- Repair: booked_stock from the undelivered items of real orders.
select private.rebook_product(p.id) from public.products p where p.unit_id <> 2;

-- Sorting from a truck: at most what is left of the product on that truck.
create or replace function public.record_sorting(
  p_product_id integer,
  p_qty_a integer,
  p_qty_b integer,
  p_qty_waste integer,
  p_shipment_id bigint default null,
  p_comment text default ''
)
returns bigint
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_total integer := coalesce(p_qty_a, 0) + coalesce(p_qty_b, 0) + coalesce(p_qty_waste, 0);
  v_ab numeric;
  v_received integer;
  v_sorted integer;
  v_id bigint;
begin
  if not coalesce(public.is_gradable(p_product_id), false) then
    raise exception 'Product % has no A/B stock', p_product_id using errcode = 'SA002';
  end if;

  if p_shipment_id is not null then
    if not exists (
      select 1 from public.shipments where id = p_shipment_id and status = 'validated'
    ) then
      raise exception 'Shipment % not found or not validated', p_shipment_id using errcode = 'SA003';
    end if;

    -- the line lock serialises concurrent sortings of the same truck line
    select i.quantity into v_received
    from public.shipment_items i
    where i.shipment_id = p_shipment_id and i.product_id = p_product_id
    for update;

    select coalesce(sum(s.qty_a + s.qty_b + s.qty_waste), 0) into v_sorted
    from public.stock_sortings s
    where s.shipment_id = p_shipment_id and s.product_id = p_product_id;

    if v_received is null or v_sorted + v_total > v_received then
      raise exception 'Only % pieces of product % are left on shipment %, % sorted',
        greatest(coalesce(v_received, 0) - v_sorted, 0), p_product_id, p_shipment_id, v_total
        using errcode = 'SA005';
    end if;
  end if;

  perform public.ensure_stock_rows(p_product_id);

  select s.stock into v_ab
  from public.stocks s
  where s.product_id = p_product_id and s.category_id = 2
  for update;

  if coalesce(v_ab, 0) < v_total then
    raise exception 'Not enough AB stock: % available, % sorted', coalesce(v_ab, 0), v_total
      using errcode = 'SA001';
  end if;

  -- check constraints reject negative or all-zero quantities
  insert into public.stock_sortings (product_id, shipment_id, qty_a, qty_b, qty_waste, comment)
  values (p_product_id, p_shipment_id, coalesce(p_qty_a, 0), coalesce(p_qty_b, 0),
          coalesce(p_qty_waste, 0), coalesce(p_comment, ''))
  returning id into v_id;

  perform private.adjust_stock(p_product_id, 1, coalesce(p_qty_a, 0), 0);
  perform private.adjust_stock(p_product_id, 2, -v_total, 0);
  perform private.adjust_stock(p_product_id, 3, coalesce(p_qty_b, 0), 0);

  return v_id;
end;
$$;

revoke execute on function public.record_sorting(integer, integer, integer, integer, bigint, text) from public, anon;
grant execute on function public.record_sorting(integer, integer, integer, integer, bigint, text) to authenticated, service_role;
