-- Emergency undo of migrations/20261124204924_deny_user_offer_conversion.sql:
-- drops deny_user and restores place_order(jsonb, jsonb) as defined in
-- 20261013132406_atomic_write_functions.sql.
-- Roll back the app first: the app version that came with the migration calls
-- deny_user and passes p_offer_to_delete, and would fail against this.

begin;

drop function if exists public.deny_user(uuid);

drop function if exists public.place_order(jsonb, jsonb, integer);

create or replace function public.place_order(p_order jsonb, p_items jsonb)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_order_id integer;
begin
  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'An order needs at least one item' using errcode = '22023';
  end if;

  insert into public.orders (
    client_id, operator_id, date_order_placed, expected_delivery,
    until_delivery_date, for_first_hour, total_amount, total_amount_final,
    voucher, comment, total_quantity, just_offer, delivery_address, delivery_fee
  )
  select
    o.client_id,
    coalesce((select auth.uid()), o.operator_id),
    now(),
    o.expected_delivery,
    coalesce(o.until_delivery_date, false),
    coalesce(o.for_first_hour, false),
    o.total_amount,
    o.total_amount_final,
    o.voucher,
    o.comment,
    coalesce(o.total_quantity, 0),
    coalesce(o.just_offer, false),
    o.delivery_address,
    coalesce(o.delivery_fee, 0)
  from jsonb_to_record(p_order) as o(
    client_id integer, operator_id uuid, expected_delivery date,
    until_delivery_date boolean, for_first_hour boolean,
    total_amount numeric, total_amount_final numeric, voucher text,
    comment text, total_quantity numeric, just_offer boolean,
    delivery_address text, delivery_fee numeric
  )
  returning id into v_order_id;

  insert into public.order_items (
    product_id, order_id, quantity, category_id, price, packs_pieces, item_status
  )
  select
    i.product_id, v_order_id, i.quantity, i.category_id, i.price,
    coalesce(i.packs_pieces, ''), false
  from jsonb_to_recordset(p_items) as i(
    product_id integer, quantity numeric, category_id integer,
    price numeric, packs_pieces text
  );

  return v_order_id;
end;
$$;

revoke execute on function public.place_order(jsonb, jsonb) from public, anon;
grant execute on function public.place_order(jsonb, jsonb) to authenticated;

commit;
