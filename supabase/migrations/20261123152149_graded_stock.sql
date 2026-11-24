-- Graded stock (A / B / AB), truck intake (shipments) and sorting.
--
-- Business rules (SPEC.md §12):
--   * stock is kept per grade: one stocks row per (product, grade);
--   * products up to 7 m (length <= 700 cm) have A, B and AB stock,
--     longer products only AB; M2 products are not graded (one row, untracked
--     by the booking triggers, as before);
--   * T (terrace) has no stock of its own: it is booked and deducted from A;
--   * a validated truck delivery adds its pieces to AB;
--   * a sorting moves pieces from AB into A and B (and waste).
--
-- Replaces the coming_wares feature (tables and RPCs are dropped at the end).
-- Run after order_item_functions.sql. Undo with
-- supabase/rollbacks/graded_stock_rollback.sql.

-- Guard: the booking trigger functions replaced below must exist, otherwise
-- the triggers on order_items point at something else and this migration
-- would leave them ungraded. Abort instead.
do $$
begin
  if to_regprocedure('public.trg_order_item_book_stock()') is null
     or to_regprocedure('public.trg_order_item_status_change()') is null
     or to_regprocedure('public.trg_order_item_delete_unbook()') is null then
    raise exception 'order_items booking trigger functions not found; check their names before running this migration';
  end if;
end;
$$;

create schema if not exists private;
grant usage on schema private to service_role;

-- Grade rule -----------------------------------------------------------------

-- Is the product tracked in A / B / AB? (not M2, at most 7 m long)
create or replace function public.is_gradable(p_product_id integer)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select p.unit_id <> 2 and coalesce(p.length, 0) <= 700
  from public.products p
  where p.id = p_product_id;
$$;

-- The stocks grade an item of p_category_id deducts from; null = not tracked.
-- Categories: 1 = A, 2 = AB, 3 = B, 4 = T. Mirrored by stockCategoryFor() in
-- src/app/shared/utils/stock.util.ts.
create or replace function public.stock_category_for(p_product_id integer, p_category_id integer)
returns integer
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select case
    when p.unit_id = 2 then null
    when coalesce(p.length, 0) > 700 then 2
    when p_category_id = 4 then 1
    when p_category_id in (1, 3) then p_category_id
    else 2
  end
  from public.products p
  where p.id = p_product_id;
$$;

-- stocks: one row per grade ----------------------------------------------------

alter table public.stocks
  add column if not exists category_id integer not null default 2;

alter table public.stocks
  drop constraint if exists stocks_category_id_check;
alter table public.stocks
  add constraint stocks_category_id_check check (category_id in (1, 2, 3));

-- Drop any unique constraint / index on product_id alone (one row per product)
do $$
declare
  v_attnum smallint;
  r record;
begin
  select attnum into v_attnum
  from pg_attribute
  where attrelid = 'public.stocks'::regclass and attname = 'product_id';

  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.stocks'::regclass
      and contype = 'u'
      and conkey = array[v_attnum]
  loop
    execute format('alter table public.stocks drop constraint %I', r.conname);
  end loop;

  for r in
    select i.indexrelid::regclass as idx
    from pg_index i
    where i.indrelid = 'public.stocks'::regclass
      and i.indisunique
      and not i.indisprimary
      and i.indkey::smallint[] = array[v_attnum]
  loop
    execute format('drop index %s', r.idx);
  end loop;
end;
$$;

-- If a product somehow has two rows today, the unique index below fails and
-- the whole migration rolls back: clean that product up by hand first.
create unique index if not exists stocks_product_category_key
  on public.stocks (product_id, category_id);

-- Every product gets its stock rows: AB always, A and B when gradable.
create or replace function public.ensure_stock_rows(p_product_id integer)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  insert into public.stocks (product_id, category_id, stock, booked_stock)
  select p_product_id, g.category_id, 0, 0
  from (values (2)) as g(category_id)
  union all
  select p_product_id, g.category_id, 0, 0
  from (values (1), (3)) as g(category_id)
  where public.is_gradable(p_product_id)
  on conflict (product_id, category_id) do nothing;
end;
$$;

-- Existing rows became AB (the column default): "current stock moves into AB".
select public.ensure_stock_rows(p.id) from public.products p;

-- Adds deltas to one grade's row (creating it when missing).
create or replace function private.adjust_stock(
  p_product_id integer,
  p_category_id integer,
  p_stock_delta numeric,
  p_booked_delta numeric
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if p_category_id is null or (p_stock_delta = 0 and p_booked_delta = 0) then
    return;
  end if;

  insert into public.stocks as s (product_id, category_id, stock, booked_stock)
  values (p_product_id, p_category_id, p_stock_delta, p_booked_delta)
  on conflict (product_id, category_id) do update
    set stock = s.stock + excluded.stock,
        booked_stock = s.booked_stock + excluded.booked_stock;
end;
$$;

revoke execute on function private.adjust_stock(integer, integer, numeric, numeric) from public, anon;
grant execute on function private.adjust_stock(integer, integer, numeric, numeric) to authenticated, service_role;

-- Recomputes a product's booked_stock per grade from the undelivered items of
-- real orders (used once below, and when a product's grade rule changes).
create or replace function private.rebook_product(p_product_id integer)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  update public.stocks s
  set booked_stock = coalesce((
    select sum(i.quantity)
    from public.order_items i
    join public.orders o on o.id = i.order_id
    where i.product_id = p_product_id
      and not coalesce(o.just_offer, false)
      and not coalesce(i.item_status, false)
      and public.stock_category_for(i.product_id, i.category_id) = s.category_id
  ), 0)
  where s.product_id = p_product_id;
end;
$$;

revoke execute on function private.rebook_product(integer) from public, anon;
grant execute on function private.rebook_product(integer) to authenticated, service_role;

-- New products get their rows atomically (replaces the client-side insert).
-- When length or unit changes so that the product is no longer graded, its A
-- and B pieces are merged into AB; bookings are then moved to the grades the
-- rule now gives (physical A/B/AB pieces otherwise stay where they are).
create or replace function private.trg_products_stock_rows()
returns trigger
language plpgsql
security invoker
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

    if new.unit_id <> 2 then
      perform private.rebook_product(new.id);
    end if;
  end if;

  return null;
end;
$$;

revoke execute on function private.trg_products_stock_rows() from public, anon;
grant execute on function private.trg_products_stock_rows() to authenticated, service_role;

drop trigger if exists products_stock_rows on public.products;
drop trigger if exists products_stock_rows_update on public.products;

create trigger products_stock_rows
  after insert on public.products
  for each row execute function private.trg_products_stock_rows();

create trigger products_stock_rows_update
  after update of length, unit_id on public.products
  for each row
  when (old.length is distinct from new.length or old.unit_id is distinct from new.unit_id)
  execute function private.trg_products_stock_rows();

-- Booking triggers on order_items, now per grade ------------------------------
--
-- Effect of one line item on stock (real orders only, graded products only):
--   not delivered -> booked_stock += quantity
--   delivered     -> stock        -= quantity
-- INSERT applies the effect, DELETE of an undelivered item removes its
-- booking (a delivered item stays deducted), UPDATE removes the old effect
-- and applies the new one, so a change of status, quantity, category or
-- product moves the booking to the right grade.

create or replace function private.order_is_real(p_order_id integer)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select coalesce((select not coalesce(o.just_offer, false)
                   from public.orders o where o.id = p_order_id), false);
$$;

revoke execute on function private.order_is_real(integer) from public, anon;
grant execute on function private.order_is_real(integer) to authenticated, service_role;

create or replace function private.apply_item_effect(
  p_order_id integer,
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
  v_grade integer;
  v_qty numeric := coalesce(p_quantity, 0) * p_sign;
begin
  if not private.order_is_real(p_order_id) then
    return;
  end if;

  v_grade := public.stock_category_for(p_product_id, p_category_id);
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

revoke execute on function private.apply_item_effect(integer, integer, integer, numeric, boolean, integer) from public, anon;
grant execute on function private.apply_item_effect(integer, integer, integer, numeric, boolean, integer) to authenticated, service_role;

create or replace function public.trg_order_item_book_stock()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  perform private.apply_item_effect(
    new.order_id, new.product_id, new.category_id, new.quantity, new.item_status, 1);
  return new;
end;
$$;

create or replace function public.trg_order_item_status_change()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if (old.product_id, old.category_id, old.quantity, coalesce(old.item_status, false))
     is not distinct from
     (new.product_id, new.category_id, new.quantity, coalesce(new.item_status, false)) then
    return new;
  end if;

  perform private.apply_item_effect(
    old.order_id, old.product_id, old.category_id, old.quantity, old.item_status, -1);
  perform private.apply_item_effect(
    new.order_id, new.product_id, new.category_id, new.quantity, new.item_status, 1);
  return new;
end;
$$;

create or replace function public.trg_order_item_delete_unbook()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if not coalesce(old.item_status, false) then
    perform private.apply_item_effect(
      old.order_id, old.product_id, old.category_id, old.quantity, false, -1);
  end if;
  return old;
end;
$$;

-- Recompute booked_stock per grade from the undelivered items of real orders
-- (M2 rows are left as they are).
select private.rebook_product(p.id) from public.products p where p.unit_id <> 2;

-- Truck deliveries ------------------------------------------------------------

create table if not exists public.shipments (
  id bigint generated always as identity primary key,
  arrived_on date not null default current_date,
  name text not null check (length(trim(name)) > 0),
  comment text not null default '',
  status text not null default 'draft' check (status in ('draft', 'validated')),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  validated_at timestamptz,
  validated_by uuid references auth.users (id) on delete set null
);

create index if not exists shipments_status_arrived_idx
  on public.shipments (status, arrived_on desc);

create table if not exists public.shipment_items (
  id bigint generated always as identity primary key,
  shipment_id bigint not null references public.shipments (id) on delete cascade,
  product_id integer not null references public.products (id),
  quantity integer not null check (quantity > 0),
  unique (shipment_id, product_id)
);

create index if not exists shipment_items_product_idx
  on public.shipment_items (product_id);

create table if not exists public.stock_sortings (
  id bigint generated always as identity primary key,
  product_id integer not null references public.products (id),
  shipment_id bigint references public.shipments (id) on delete set null,
  qty_a integer not null default 0 check (qty_a >= 0),
  qty_b integer not null default 0 check (qty_b >= 0),
  qty_waste integer not null default 0 check (qty_waste >= 0),
  comment text not null default '',
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (qty_a + qty_b + qty_waste > 0)
);

create index if not exists stock_sortings_product_idx
  on public.stock_sortings (product_id, created_at desc);
create index if not exists stock_sortings_shipment_idx
  on public.stock_sortings (shipment_id);

-- RLS: any approved user registers, validates and sorts (SPEC.md §24)
do $$
declare
  t text;
begin
  foreach t in array array['shipments', 'shipment_items', 'stock_sortings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Approved users have full access" on public.%I', t);
    execute format(
      'create policy "Approved users have full access" on public.%I
         for all to authenticated
         using ((select private.is_approved()))
         with check ((select private.is_approved()))', t);
  end loop;
end;
$$;

-- Creates a draft (p_shipment without id) or replaces the header and lines of
-- an existing draft. Lines of the same product are summed. Returns the id.
create or replace function public.save_shipment(p_shipment jsonb, p_items jsonb)
returns bigint
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id bigint := nullif(p_shipment ->> 'id', '')::bigint;
begin
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
    insert into public.shipments (arrived_on, name, comment)
    select coalesce(s.arrived_on, current_date), s.name, coalesce(s.comment, '')
    from jsonb_to_record(p_shipment) as s(arrived_on date, name text, comment text)
    returning id into v_id;
  else
    update public.shipments sh
    set arrived_on = coalesce(s.arrived_on, sh.arrived_on),
        name = s.name,
        comment = coalesce(s.comment, '')
    from jsonb_to_record(p_shipment) as s(arrived_on date, name text, comment text)
    where sh.id = v_id and sh.status = 'draft';

    if not found then
      raise exception 'Shipment % not found or already validated', v_id using errcode = 'SA003';
    end if;

    delete from public.shipment_items where shipment_id = v_id;
  end if;

  insert into public.shipment_items (shipment_id, product_id, quantity)
  select v_id, i.product_id, sum(i.quantity)
  from jsonb_to_recordset(p_items) as i(product_id integer, quantity integer)
  group by i.product_id;

  return v_id;
end;
$$;

-- Marks a draft validated and adds its pieces to AB stock, once.
create or replace function public.validate_shipment(p_shipment_id bigint)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  r record;
begin
  update public.shipments
  set status = 'validated',
      validated_at = now(),
      validated_by = (select auth.uid())
  where id = p_shipment_id and status = 'draft';

  if not found then
    raise exception 'Shipment % not found or already validated', p_shipment_id using errcode = 'SA003';
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

-- Deletes a draft; a validated shipment already moved stock and stays.
create or replace function public.delete_shipment(p_shipment_id bigint)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  delete from public.shipments where id = p_shipment_id and status = 'draft';

  if not found then
    raise exception 'Shipment % not found or already validated', p_shipment_id using errcode = 'SA003';
  end if;
end;
$$;

-- Sorting: AB -= a + b + waste, A += a, B += b. Returns the sorting id.
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

-- Undoes a sorting (typo fix): moves the pieces back into AB.
create or replace function public.delete_sorting(p_sorting_id bigint)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v public.stock_sortings%rowtype;
begin
  delete from public.stock_sortings where id = p_sorting_id returning * into v;

  if v.id is null then
    raise exception 'Sorting % not found', p_sorting_id using errcode = 'P0002';
  end if;

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

revoke execute on function
  public.is_gradable(integer),
  public.stock_category_for(integer, integer),
  public.ensure_stock_rows(integer),
  public.save_shipment(jsonb, jsonb),
  public.validate_shipment(bigint),
  public.delete_shipment(bigint),
  public.record_sorting(integer, integer, integer, integer, bigint, text),
  public.delete_sorting(bigint)
from public, anon;

grant execute on function
  public.is_gradable(integer),
  public.stock_category_for(integer, integer),
  public.ensure_stock_rows(integer),
  public.save_shipment(jsonb, jsonb),
  public.validate_shipment(bigint),
  public.delete_shipment(bigint),
  public.record_sorting(integer, integer, integer, integer, bigint, text),
  public.delete_sorting(bigint)
to authenticated, service_role;

-- Remove coming_wares (replaced by shipments) ---------------------------------

-- Unverified deliveries would be lost: re-enter them as shipments (or delete
-- them) before running this migration.
do $$
declare
  v_pending integer;
begin
  if to_regclass('public.coming_wares') is not null then
    execute 'select count(*) from public.coming_wares where verified is not true' into v_pending;
    if v_pending > 0 then
      raise exception '% unverified coming_wares deliveries exist; move them to shipments first', v_pending;
    end if;
  end if;
end;
$$;

drop function if exists public.place_coming_wares(jsonb, jsonb);
drop function if exists public.verify_coming_wares(bigint);
drop function if exists public.delete_coming_wares(bigint);
drop table if exists public.coming_wares_items;
drop table if exists public.coming_wares;

-- Legacy stock RPCs (unused by the app) update stocks by product_id alone,
-- which would now hit every grade row of the product.
drop function if exists public.add_to_product_stock(bigint, integer);
drop function if exists public.product_booked_stock_sold(bigint, integer);
