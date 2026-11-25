-- 1. deny_user: an admin's "Deny" erases the sign-in account, not only the
--    profile. Until now the app deleted the profiles row and left auth.users,
--    so the person could neither log in nor sign up again with that email.
--    Only users still waiting for approval can be denied; an approved user is
--    never erased this way (SPEC.md §8.14).
--
-- 2. place_order(p_order, p_items, p_offer_to_delete): "Creare comandă" with
--    "Șterge oferta" ticked soft-deletes the source offer in the same
--    transaction as the new order, instead of when the offer is loaded into the
--    cart. If the order is not saved, the offer stays where it was.
--    Called without the third argument it behaves exactly as before, so the
--    app version deployed now keeps working until the new one is live.

-- 1. deny_user ----------------------------------------------------------------

create or replace function public.deny_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_approved boolean;
begin
  if not coalesce((select private.is_admin()), false) then
    raise exception 'Only admins can deny users' using errcode = '42501';
  end if;

  if p_user_id = (select auth.uid()) then
    raise exception 'You cannot deny yourself' using errcode = '42501';
  end if;

  select p.approved into v_approved
  from public.profiles p
  where p.id = p_user_id
  for update;

  if not found then
    raise exception 'User % not found', p_user_id using errcode = 'P0002';
  end if;

  if v_approved then
    raise exception 'Only users waiting for approval can be denied' using errcode = '42501';
  end if;

  delete from public.admin_users where id = p_user_id;
  delete from public.profiles where id = p_user_id;
  -- identities, sessions, refresh tokens etc. go with it (on delete cascade)
  delete from auth.users where id = p_user_id;
end;
$$;

revoke execute on function public.deny_user(uuid) from public, anon;
grant execute on function public.deny_user(uuid) to authenticated;

-- 2. place_order with the offer it replaces ----------------------------------

drop function if exists public.place_order(jsonb, jsonb);

create or replace function public.place_order(
  p_order jsonb,
  p_items jsonb,
  p_offer_to_delete integer default null
)
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

  -- The order row must exist first: the booking trigger on order_items reads
  -- orders.just_offer to decide whether stock is booked.
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

  -- Soft delete, as from the offers table: RLS and orders_guard_deletion apply
  -- (any approved user may delete an offer). Only an offer, never an order; an
  -- offer someone deleted meanwhile is left alone and the order still saves.
  if p_offer_to_delete is not null then
    update public.orders
    set deleted_at = now()
    where id = p_offer_to_delete
      and just_offer
      and deleted_at is null;
  end if;

  return v_order_id;
end;
$$;

revoke execute on function public.place_order(jsonb, jsonb, integer) from public, anon;
grant execute on function public.place_order(jsonb, jsonb, integer) to authenticated;
