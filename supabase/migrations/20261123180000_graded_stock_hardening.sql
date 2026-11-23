-- Graded stock hardening (review round after 20261123152149_graded_stock and
-- 20261123163000_offer_conversion_booking).
--
--  1. shipments / shipment_items / stock_sortings become read-only through
--     the API: every write goes through an RPC. The RPCs run as security
--     definer and check private.is_approved() themselves, so nobody can set a
--     validated truck back to draft (and add its AB stock twice) or delete a
--     sorting row without moving the stock back. created_by / validated_by
--     are always the caller.
--  2. created_by / validated_by reference public.profiles, so the app can
--     show who registered, validated and sorted (like orders.operator_id).
--  3. set_stock: hand stock edit that refuses to overwrite a change made
--     meanwhile (SA006) and logs every edit in stock_adjustments.
--  4. save_shipment refuses to overwrite a draft changed meanwhile (SA007).
--  5. delete_sorting locks the stock rows it checks.
--  6. validate_shipment refuses lines whose product became M2.
--  7. A product changed to M2 drops its bookings (they could never be
--     released, M2 is not tracked).
--  8. shipments_with_remaining(product): validated trucks that still have
--     unsorted pieces of a product (sorting dialog on the products page).
--  9. Index for the per-truck sorted sum.
-- 10. stocks is written only by database functions: the API role can read it
--     but not insert, update or delete (hand edits = set_stock).
--
-- Undo with supabase/rollbacks/graded_stock_hardening_rollback.sql.

-- 2. who did what ------------------------------------------------------------

-- a user without a profile cannot be referenced; such ids are dropped
update public.shipments s set created_by = null
where created_by is not null and not exists (select 1 from public.profiles p where p.id = s.created_by);
update public.shipments s set validated_by = null
where validated_by is not null and not exists (select 1 from public.profiles p where p.id = s.validated_by);
update public.stock_sortings s set created_by = null
where created_by is not null and not exists (select 1 from public.profiles p where p.id = s.created_by);

alter table public.shipments drop constraint if exists shipments_created_by_fkey;
alter table public.shipments drop constraint if exists shipments_validated_by_fkey;
alter table public.stock_sortings drop constraint if exists stock_sortings_created_by_fkey;

alter table public.shipments
  add constraint shipments_created_by_fkey
    foreign key (created_by) references public.profiles (id) on delete set null,
  add constraint shipments_validated_by_fkey
    foreign key (validated_by) references public.profiles (id) on delete set null;
alter table public.stock_sortings
  add constraint stock_sortings_created_by_fkey
    foreign key (created_by) references public.profiles (id) on delete set null;

-- 4. draft version ------------------------------------------------------------

alter table public.shipments
  add column if not exists updated_at timestamptz not null default now();

-- 9. index ---------------------------------------------------------------------

drop index if exists public.stock_sortings_shipment_idx;
create index if not exists stock_sortings_shipment_product_idx
  on public.stock_sortings (shipment_id, product_id);

-- 1. read-only tables ----------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['shipments', 'shipment_items', 'stock_sortings'] loop
    execute format('drop policy if exists "Approved users have full access" on public.%I', t);
    execute format('drop policy if exists "Approved users can read" on public.%I', t);
    execute format(
      'create policy "Approved users can read" on public.%I
         for select to authenticated
         using ((select private.is_approved()))', t);
  end loop;
end;
$$;

-- 3. audited hand stock edit ---------------------------------------------------

create table if not exists public.stock_adjustments (
  id bigint generated always as identity primary key,
  stock_id bigint not null references public.stocks (id) on delete cascade,
  product_id integer not null references public.products (id),
  category_id integer not null,
  old_stock numeric not null,
  new_stock numeric not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists stock_adjustments_product_idx
  on public.stock_adjustments (product_id, created_at desc);
create index if not exists stock_adjustments_stock_idx
  on public.stock_adjustments (stock_id);

alter table public.stock_adjustments enable row level security;
drop policy if exists "Approved users can read" on public.stock_adjustments;
create policy "Approved users can read" on public.stock_adjustments
  for select to authenticated
  using ((select private.is_approved()));

-- Sets one grade's stock to p_new, but only if it still is p_expected (the
-- value the user started editing from). Raises SA006 otherwise.
create or replace function public.set_stock(p_stock_id bigint, p_expected numeric, p_new numeric)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v public.stocks%rowtype;
begin
  if not coalesce((select private.is_approved()), false) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if p_new is null or p_new < 0 then
    raise exception 'Stock must be 0 or more' using errcode = '22023';
  end if;

  select * into v from public.stocks where id = p_stock_id for update;

  if not found then
    raise exception 'Stock row % not found', p_stock_id using errcode = 'P0002';
  end if;

  if v.stock is distinct from p_expected then
    raise exception 'Stock row % changed meanwhile: % now, % expected', p_stock_id, v.stock, p_expected
      using errcode = 'SA006';
  end if;

  if v.stock = p_new then
    return;
  end if;

  update public.stocks set stock = p_new where id = p_stock_id;

  insert into public.stock_adjustments (stock_id, product_id, category_id, old_stock, new_stock, created_by)
  values (v.id, v.product_id, v.category_id, v.stock, p_new, (select auth.uid()));
end;
$$;

-- 1 + 4. shipments RPCs ---------------------------------------------------------

create or replace function public.save_shipment(p_shipment jsonb, p_items jsonb)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint := nullif(p_shipment ->> 'id', '')::bigint;
  v_expected timestamptz := nullif(p_shipment ->> 'updated_at', '')::timestamptz;
  v_current public.shipments%rowtype;
begin
  if not coalesce((select private.is_approved()), false) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'A shipment needs at least one line' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as i(product_id integer, quantity integer)
    join public.products p on p.id = i.product_id
    where p.unit_id = 2
  ) then
    raise exception 'M2 products have no graded stock' using errcode = 'SA002';
  end if;

  if v_id is null then
    insert into public.shipments (arrived_on, name, comment, created_by)
    select coalesce(s.arrived_on, current_date), s.name, coalesce(s.comment, ''), (select auth.uid())
    from jsonb_to_record(p_shipment) as s(arrived_on date, name text, comment text)
    returning id into v_id;
  else
    select * into v_current from public.shipments where id = v_id for update;

    if not found or v_current.status <> 'draft' then
      raise exception 'Shipment % not found or already validated', v_id using errcode = 'SA003';
    end if;

    -- an older app version sends no updated_at; it keeps last-writer-wins
    if v_expected is not null and v_expected <> v_current.updated_at then
      raise exception 'Shipment % was changed by someone else', v_id using errcode = 'SA007';
    end if;

    update public.shipments sh
    set arrived_on = coalesce(s.arrived_on, sh.arrived_on),
        name = s.name,
        comment = coalesce(s.comment, ''),
        updated_at = clock_timestamp()
    from jsonb_to_record(p_shipment) as s(arrived_on date, name text, comment text)
    where sh.id = v_id;

    delete from public.shipment_items where shipment_id = v_id;
  end if;

  insert into public.shipment_items (shipment_id, product_id, quantity)
  select v_id, i.product_id, sum(i.quantity)
  from jsonb_to_recordset(p_items) as i(product_id integer, quantity integer)
  group by i.product_id;

  return v_id;
end;
$$;

create or replace function public.validate_shipment(p_shipment_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
begin
  if not coalesce((select private.is_approved()), false) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  update public.shipments
  set status = 'validated',
      validated_at = now(),
      validated_by = (select auth.uid()),
      updated_at = clock_timestamp()
  where id = p_shipment_id and status = 'draft';

  if not found then
    raise exception 'Shipment % not found or already validated', p_shipment_id using errcode = 'SA003';
  end if;

  -- a product may have become M2 after the draft was saved
  if exists (
    select 1
    from public.shipment_items i
    join public.products p on p.id = i.product_id
    where i.shipment_id = p_shipment_id and p.unit_id = 2
  ) then
    raise exception 'M2 products have no graded stock' using errcode = 'SA002';
  end if;

  -- fixed order keeps concurrent validations from deadlocking on stocks rows
  for r in
    select product_id, quantity
    from public.shipment_items
    where shipment_id = p_shipment_id
    order by product_id
  loop
    perform public.ensure_stock_rows(r.product_id);
    perform private.adjust_stock(r.product_id, 2, r.quantity, 0);
  end loop;
end;
$$;

create or replace function public.delete_shipment(p_shipment_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not coalesce((select private.is_approved()), false) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  delete from public.shipments where id = p_shipment_id and status = 'draft';

  if not found then
    raise exception 'Shipment % not found or already validated', p_shipment_id using errcode = 'SA003';
  end if;
end;
$$;

-- 1. sorting RPCs ----------------------------------------------------------------

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
security definer
set search_path = public, pg_temp
as $$
declare
  v_total integer := coalesce(p_qty_a, 0) + coalesce(p_qty_b, 0) + coalesce(p_qty_waste, 0);
  v_ab numeric;
  v_received integer;
  v_sorted integer;
  v_id bigint;
begin
  if not coalesce((select private.is_approved()), false) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

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

  -- sorting may take AB pieces that orders booked (AB free then goes
  -- negative, the dialog warns); only the physical AB stock limits it
  select s.stock into v_ab
  from public.stocks s
  where s.product_id = p_product_id and s.category_id = 2
  for update;

  if coalesce(v_ab, 0) < v_total then
    raise exception 'Not enough AB stock: % available, % sorted', coalesce(v_ab, 0), v_total
      using errcode = 'SA001';
  end if;

  -- check constraints reject negative or all-zero quantities
  insert into public.stock_sortings (product_id, shipment_id, qty_a, qty_b, qty_waste, comment, created_by)
  values (p_product_id, p_shipment_id, coalesce(p_qty_a, 0), coalesce(p_qty_b, 0),
          coalesce(p_qty_waste, 0), coalesce(p_comment, ''), (select auth.uid()))
  returning id into v_id;

  perform private.adjust_stock(p_product_id, 1, coalesce(p_qty_a, 0), 0);
  perform private.adjust_stock(p_product_id, 2, -v_total, 0);
  perform private.adjust_stock(p_product_id, 3, coalesce(p_qty_b, 0), 0);

  return v_id;
end;
$$;

create or replace function public.delete_sorting(p_sorting_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v public.stock_sortings%rowtype;
begin
  if not coalesce((select private.is_approved()), false) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  delete from public.stock_sortings where id = p_sorting_id returning * into v;

  if v.id is null then
    raise exception 'Sorting % not found', p_sorting_id using errcode = 'P0002';
  end if;

  -- lock the product's stock rows (fixed order) so two undos cannot both pass
  perform 1
  from public.stocks s
  where s.product_id = v.product_id
  order by s.category_id
  for update;

  -- the sorted A / B pieces must still be in stock to be put back into AB
  if exists (
    select 1
    from public.stocks s
    where s.product_id = v.product_id
      and ((s.category_id = 1 and s.stock < v.qty_a) or (s.category_id = 3 and s.stock < v.qty_b))
  ) then
    raise exception 'Sorted pieces of sorting % are no longer in stock', p_sorting_id
      using errcode = 'SA004';
  end if;

  perform private.adjust_stock(v.product_id, 1, -v.qty_a, 0);
  perform private.adjust_stock(v.product_id, 2, v.qty_a + v.qty_b + v.qty_waste, 0);
  perform private.adjust_stock(v.product_id, 3, -v.qty_b, 0);
end;
$$;

-- 8. trucks with pieces left of a product -----------------------------------------

create or replace function public.shipments_with_remaining(p_product_id integer)
returns table (
  id bigint,
  name text,
  arrived_on date,
  received integer,
  sorted integer,
  remaining integer
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select s.id, s.name, s.arrived_on, i.quantity,
         coalesce(sum(ss.qty_a + ss.qty_b + ss.qty_waste), 0)::integer,
         (i.quantity - coalesce(sum(ss.qty_a + ss.qty_b + ss.qty_waste), 0))::integer
  from public.shipments s
  join public.shipment_items i on i.shipment_id = s.id and i.product_id = p_product_id
  left join public.stock_sortings ss on ss.shipment_id = s.id and ss.product_id = p_product_id
  where s.status = 'validated'
  group by s.id, s.name, s.arrived_on, i.quantity
  having i.quantity - coalesce(sum(ss.qty_a + ss.qty_b + ss.qty_waste), 0) > 0
  order by s.arrived_on, s.id;
$$;

-- 7. product becomes M2 -----------------------------------------------------------
-- rebook_product sets every booking of an M2 product to 0 (stock_category_for
-- gives null for M2, so no item matches a grade); it is now called for every
-- unit, the old "unit_id <> 2" skip stranded the bookings on AB.

create or replace function private.trg_products_stock_rows()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.ensure_stock_rows(new.id);

  if tg_op = 'UPDATE' then
    if not public.is_gradable(new.id) then
      update public.stocks ab
      set stock = ab.stock + x.stock,
          booked_stock = ab.booked_stock + x.booked_stock
      from (
        select coalesce(sum(stock), 0) as stock, coalesce(sum(booked_stock), 0) as booked_stock
        from public.stocks
        where product_id = new.id and category_id in (1, 3)
      ) x
      where ab.product_id = new.id and ab.category_id = 2;

      delete from public.stocks where product_id = new.id and category_id in (1, 3);
    end if;

    perform private.rebook_product(new.id);
  end if;

  return null;
end;
$$;

-- 10. stocks: written only by database functions -----------------------------------
-- Hand edits go through set_stock (conflict check + audit log). Bookings and
-- deliveries reach stocks through private.adjust_stock, called by the
-- order_items triggers as the signed-in user, so it runs as definer. The API
-- role keeps reading stocks (RLS policy unchanged) but cannot write it, so a
-- direct PATCH can no longer skip set_stock.

alter function private.adjust_stock(integer, integer, numeric, numeric) security definer;
alter function public.ensure_stock_rows(integer) security definer;
alter function private.rebook_product(integer) security definer;

-- only called by the definer functions and triggers above, never by the app
revoke execute on function public.ensure_stock_rows(integer) from authenticated;

revoke insert, update, delete on public.stocks from anon, authenticated;

-- grants ---------------------------------------------------------------------------

revoke execute on function
  public.set_stock(bigint, numeric, numeric),
  public.save_shipment(jsonb, jsonb),
  public.validate_shipment(bigint),
  public.delete_shipment(bigint),
  public.record_sorting(integer, integer, integer, integer, bigint, text),
  public.delete_sorting(bigint),
  public.shipments_with_remaining(integer)
from public, anon;

grant execute on function
  public.set_stock(bigint, numeric, numeric),
  public.save_shipment(jsonb, jsonb),
  public.validate_shipment(bigint),
  public.delete_shipment(bigint),
  public.record_sorting(integer, integer, integer, integer, bigint, text),
  public.delete_sorting(bigint),
  public.shipments_with_remaining(integer)
to authenticated, service_role;
