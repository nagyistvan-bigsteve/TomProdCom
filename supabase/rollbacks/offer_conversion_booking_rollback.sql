-- Emergency undo of migrations/20261123163000_offer_conversion_booking.sql.
--
-- Removes the offer <-> order conversion trigger and restores record_sorting
-- as defined in 20261123152149_graded_stock.sql (no per-truck cap).
-- booked_stock is recomputed from open real-order items, which stays correct
-- without the trigger until the next offer is converted.

begin;

-- record_sorting below is the pre-hardening version; undo the hardening first.
do $$
begin
  if to_regprocedure('public.set_stock(bigint, numeric, numeric)') is not null then
    raise exception 'Run graded_stock_hardening_rollback.sql first';
  end if;
end;
$$;

drop trigger if exists orders_offer_conversion_stock on public.orders;
drop function if exists private.trg_order_offer_conversion();
drop function if exists private.item_stock_effect(integer, integer, numeric, boolean, integer);

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
  v_id bigint;
begin
  if not coalesce(public.is_gradable(p_product_id), false) then
    raise exception 'Product % has no A/B stock', p_product_id using errcode = 'SA002';
  end if;

  if p_shipment_id is not null and not exists (
    select 1 from public.shipments where id = p_shipment_id and status = 'validated'
  ) then
    raise exception 'Shipment % not found or not validated', p_shipment_id using errcode = 'SA003';
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

select private.rebook_product(p.id) from public.products p where p.unit_id <> 2;

commit;
