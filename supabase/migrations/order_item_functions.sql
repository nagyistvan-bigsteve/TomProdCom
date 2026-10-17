-- Line-item changes on an existing order / offer, each in one transaction
-- together with the order totals.
--
-- The app computes the new totals (total_amount, total_amount_final,
-- total_quantity) from the item list after the change and passes them in, so
-- the pricing formulas stay in one place (the frontend). Before, the item and
-- the totals were separate requests with a 250 ms wait in between.
--
-- Run after rls_admin_only_writes.sql (uses the private schema).

create schema if not exists private;

create or replace function private.set_order_totals(p_order_id integer, p_totals jsonb)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  update public.orders o
  set total_amount = t.total_amount,
      total_amount_final = t.total_amount_final,
      total_quantity = t.total_quantity
  from jsonb_to_record(p_totals) as t(
    total_amount numeric, total_amount_final numeric, total_quantity numeric
  )
  where o.id = p_order_id;

  if not found then
    raise exception 'Order % not found', p_order_id using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function private.set_order_totals(integer, jsonb) from public, anon;
grant execute on function private.set_order_totals(integer, jsonb) to authenticated;

-- Adds a line item; returns its id.
create or replace function public.add_order_item(
  p_order_id integer,
  p_item jsonb,
  p_totals jsonb
)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_item_id integer;
begin
  insert into public.order_items (
    product_id, order_id, quantity, category_id, price, packs_pieces, item_status
  )
  select
    i.product_id, p_order_id, i.quantity, i.category_id, i.price,
    coalesce(i.packs_pieces, ''), false
  from jsonb_to_record(p_item) as i(
    product_id integer, quantity numeric, category_id integer,
    price numeric, packs_pieces text
  )
  returning id into v_item_id;

  perform private.set_order_totals(p_order_id, p_totals);

  return v_item_id;
end;
$$;

-- Changes the given fields of a line item (any of category_id, quantity,
-- price, packs_pieces); fields not present in p_changes are left alone.
create or replace function public.update_order_item(
  p_item_id integer,
  p_changes jsonb,
  p_totals jsonb
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_order_id integer;
begin
  update public.order_items
  set category_id = case when p_changes ? 'category_id'
                         then (p_changes ->> 'category_id')::integer else category_id end,
      quantity = case when p_changes ? 'quantity'
                      then (p_changes ->> 'quantity')::numeric else quantity end,
      price = case when p_changes ? 'price'
                   then (p_changes ->> 'price')::numeric else price end,
      packs_pieces = case when p_changes ? 'packs_pieces'
                          then p_changes ->> 'packs_pieces' else packs_pieces end
  where id = p_item_id
  returning order_id into v_order_id;

  if v_order_id is null then
    raise exception 'Order item % not found', p_item_id using errcode = 'P0002';
  end if;

  perform private.set_order_totals(v_order_id, p_totals);
end;
$$;

-- Removes a line item (the unbook trigger releases its booked stock).
create or replace function public.delete_order_item(p_item_id integer, p_totals jsonb)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_order_id integer;
begin
  delete from public.order_items
  where id = p_item_id
  returning order_id into v_order_id;

  if v_order_id is null then
    raise exception 'Order item % not found', p_item_id using errcode = 'P0002';
  end if;

  perform private.set_order_totals(v_order_id, p_totals);
end;
$$;

revoke execute on function
  public.add_order_item(integer, jsonb, jsonb),
  public.update_order_item(integer, jsonb, jsonb),
  public.delete_order_item(integer, jsonb)
from public, anon;

grant execute on function
  public.add_order_item(integer, jsonb, jsonb),
  public.update_order_item(integer, jsonb, jsonb),
  public.delete_order_item(integer, jsonb)
to authenticated;
