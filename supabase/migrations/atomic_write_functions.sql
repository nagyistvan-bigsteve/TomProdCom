-- Atomic write functions.
--
-- Each function replaces a sequence of separate client-side requests with a
-- single transaction, so a failure half-way cannot leave partial data behind.
-- All functions are SECURITY INVOKER: the caller's RLS policies still apply.
--
-- search_path is pinned to public (not ''): the existing order_items triggers
-- reference orders/products/stocks unqualified and inherit this setting.

-- Order / offer together with its line items -------------------------------

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

  return v_order_id;
end;
$$;

-- Marks every line item and the order itself as delivered.
create or replace function public.mark_order_delivered(p_order_id integer)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  update public.order_items
  set item_status = true
  where order_id = p_order_id
    and item_status is distinct from true;

  update public.orders
  set date_order_delivered = (now() at time zone 'utc')::date
  where id = p_order_id;

  if not found then
    raise exception 'Order % not found', p_order_id using errcode = 'P0002';
  end if;
end;
$$;

-- Hard-deletes an order with its line items.
create or replace function public.delete_order_permanently(p_order_id integer)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  delete from public.order_items where order_id = p_order_id;
  delete from public.orders where id = p_order_id;
end;
$$;

-- Clients with their phone numbers -----------------------------------------

create or replace function public.add_client_with_phones(p_client jsonb, p_phones jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_client_id integer;
  v_result jsonb;
begin
  insert into public.clients (type, name, address, code, other_details, tva)
  select n.type, n.name, n.address, n.code, n.other_details, coalesce(n.tva, false)
  from jsonb_to_record(p_client) as n(
    type integer, name varchar, address varchar, code varchar,
    other_details varchar, tva boolean
  )
  returning id into v_client_id;

  insert into public.client_phones (client_id, phone, label)
  select v_client_id, ph.phone, ph.label
  from jsonb_to_recordset(coalesce(p_phones, '[]'::jsonb)) as ph(phone varchar, label text);

  select to_jsonb(c) || jsonb_build_object(
    'client_phones',
    coalesce(
      (select jsonb_agg(to_jsonb(p) order by p.id)
       from public.client_phones p
       where p.client_id = c.id),
      '[]'::jsonb
    )
  )
  into v_result
  from public.clients c
  where c.id = v_client_id;

  return v_result;
end;
$$;

-- Phones are replaced as a whole (delete + insert) in the same transaction.
create or replace function public.update_client_with_phones(
  p_client_id integer,
  p_client jsonb,
  p_phones jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  update public.clients c
  set type = n.type,
      name = n.name,
      address = n.address,
      code = n.code,
      other_details = n.other_details,
      tva = coalesce(n.tva, false)
  from jsonb_to_record(p_client) as n(
    type integer, name varchar, address varchar, code varchar,
    other_details varchar, tva boolean
  )
  where c.id = p_client_id;

  if not found then
    raise exception 'Client % not found', p_client_id using errcode = 'P0002';
  end if;

  delete from public.client_phones where client_id = p_client_id;

  insert into public.client_phones (client_id, phone, label)
  select p_client_id, ph.phone, ph.label
  from jsonb_to_recordset(coalesce(p_phones, '[]'::jsonb)) as ph(phone varchar, label text);

  select to_jsonb(c) || jsonb_build_object(
    'client_phones',
    coalesce(
      (select jsonb_agg(to_jsonb(p) order by p.id)
       from public.client_phones p
       where p.client_id = c.id),
      '[]'::jsonb
    )
  )
  into v_result
  from public.clients c
  where c.id = p_client_id;

  return v_result;
end;
$$;

-- User roles ---------------------------------------------------------------

-- Keeps profiles.role and the admin_users membership table in step.
create or replace function public.set_user_role(p_user_id uuid, p_role text)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_profile jsonb;
begin
  if p_role not in ('user', 'admin') then
    raise exception 'Unknown role %', p_role using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.admin_users a where a.id = (select auth.uid())
  ) then
    raise exception 'Only admins can change roles' using errcode = '42501';
  end if;

  update public.profiles p
  set role = p_role
  where p.id = p_user_id
  returning to_jsonb(p) into v_profile;

  if v_profile is null then
    raise exception 'Profile % not found', p_user_id using errcode = 'P0002';
  end if;

  if p_role = 'admin' then
    insert into public.admin_users (id) values (p_user_id)
    on conflict (id) do nothing;
  else
    delete from public.admin_users where id = p_user_id;
  end if;

  return v_profile;
end;
$$;

-- Incoming shipments -------------------------------------------------------

create or replace function public.place_coming_wares(p_wares jsonb, p_items jsonb)
returns bigint
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_wares_id bigint;
begin
  insert into public.coming_wares (
    expected_delivery, name, total_quantity, all_for_order, comment
  )
  select
    w.expected_delivery, w.name, w.total_quantity,
    coalesce(w.all_for_order, false), w.comment
  from jsonb_to_record(p_wares) as w(
    expected_delivery date, name text, total_quantity numeric,
    all_for_order boolean, comment text
  )
  returning id into v_wares_id;

  insert into public.coming_wares_items (
    order_id, product_id, category, quantity, for_order, comment
  )
  select
    v_wares_id, i.product_id, i.category, i.quantity,
    coalesce(i.for_order, false), ''
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as i(
    product_id integer, category integer, quantity numeric, for_order boolean
  );

  return v_wares_id;
end;
$$;

-- Marks a shipment verified and adds its correct warehouse items to stock.
-- Refuses an already verified shipment so stock cannot be added twice.
create or replace function public.verify_coming_wares(p_wares_id bigint)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  update public.coming_wares
  set verified = true
  where id = p_wares_id
    and verified is not true;

  if not found then
    raise exception 'Shipment % not found or already verified', p_wares_id
      using errcode = 'P0002';
  end if;

  update public.stocks s
  set stock = s.stock + q.quantity
  from (
    select i.product_id, sum(i.quantity) as quantity
    from public.coming_wares_items i
    where i.order_id = p_wares_id
      and i.for_order is not true
      and i.is_correct is true
    group by i.product_id
  ) q
  where s.product_id = q.product_id;
end;
$$;

create or replace function public.delete_coming_wares(p_wares_id bigint)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  delete from public.coming_wares_items where order_id = p_wares_id;
  delete from public.coming_wares where id = p_wares_id;
end;
$$;

-- Signed-in users only -----------------------------------------------------

revoke execute on function
  public.place_order(jsonb, jsonb),
  public.mark_order_delivered(integer),
  public.delete_order_permanently(integer),
  public.add_client_with_phones(jsonb, jsonb),
  public.update_client_with_phones(integer, jsonb, jsonb),
  public.set_user_role(uuid, text),
  public.place_coming_wares(jsonb, jsonb),
  public.verify_coming_wares(bigint),
  public.delete_coming_wares(bigint)
from public, anon;

grant execute on function
  public.place_order(jsonb, jsonb),
  public.mark_order_delivered(integer),
  public.delete_order_permanently(integer),
  public.add_client_with_phones(jsonb, jsonb),
  public.update_client_with_phones(integer, jsonb, jsonb),
  public.set_user_role(uuid, text),
  public.place_coming_wares(jsonb, jsonb),
  public.verify_coming_wares(bigint),
  public.delete_coming_wares(bigint)
to authenticated;
