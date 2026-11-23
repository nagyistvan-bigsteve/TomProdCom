-- Emergency undo of migrations/20261123152149_graded_stock.sql.
--
-- The trigger function bodies, the coming_wares DDL, policies and functions
-- below are the originals dumped from the staging database on 2026-11-23,
-- before the migration ran (pg_get_functiondef / information_schema /
-- pg_policies). Check that production matched before relying on it there.
--
-- Stock is merged back into one row per product (A + B + AB summed), so the
-- A/B split recorded since the migration is lost. Shipments and sortings are
-- dropped with their history. coming_wares is recreated empty.

begin;

-- Order matters: the later migrations build on this one. Undo them first:
--   1. graded_stock_hardening_rollback.sql
--   2. offer_conversion_booking_rollback.sql
--   3. this script
do $$
begin
  if to_regprocedure('private.item_stock_effect(integer, integer, numeric, boolean, integer)') is not null then
    raise exception 'Run offer_conversion_booking_rollback.sql (after graded_stock_hardening_rollback.sql) first';
  end if;
  if to_regprocedure('public.set_stock(bigint, numeric, numeric)') is not null then
    raise exception 'Run graded_stock_hardening_rollback.sql first';
  end if;
end;
$$;

-- Booking triggers: original bodies (one stock row per product) -------------
-- (originals were security invoker with no pinned search_path; kept as-is)

create or replace function public.trg_order_item_book_stock()
returns trigger
language plpgsql
as $function$
declare v_unit_id integer; v_just_offer boolean;
begin
  select just_offer into v_just_offer from orders where id = new.order_id;
  if v_just_offer = true then return new; end if;
  select unit_id into v_unit_id from products where id = new.product_id;
  if v_unit_id is not null and v_unit_id != 2 then
    update stocks set booked_stock = booked_stock + new.quantity where product_id = new.product_id;
  end if;
  return new;
end;
$function$;

create or replace function public.trg_order_item_status_change()
returns trigger
language plpgsql
as $function$
declare v_unit_id integer; v_just_offer boolean;
begin
  if old.item_status is distinct from new.item_status then
    select just_offer into v_just_offer from orders where id = new.order_id;
    if v_just_offer = true then return new; end if;
    select unit_id into v_unit_id from products where id = new.product_id;
    if v_unit_id is not null and v_unit_id != 2 then
      if old.item_status = false and new.item_status = true then
        update stocks set booked_stock = booked_stock - new.quantity, stock = stock - new.quantity
        where product_id = new.product_id;
      elsif old.item_status = true and new.item_status = false then
        update stocks set booked_stock = booked_stock + new.quantity, stock = stock + new.quantity
        where product_id = new.product_id;
      end if;
    end if;
  end if;
  return new;
end;
$function$;

create or replace function public.trg_order_item_delete_unbook()
returns trigger
language plpgsql
as $function$
declare v_unit_id integer; v_just_offer boolean;
begin
  if old.item_status = false then
    select just_offer into v_just_offer from orders where id = old.order_id;
    if v_just_offer = true then return old; end if;
    select unit_id into v_unit_id from products where id = old.product_id;
    if v_unit_id is not null and v_unit_id != 2 then
      update stocks set booked_stock = booked_stock - old.quantity where product_id = old.product_id;
      if not found then raise exception 'No stock row for product_id %', old.product_id; end if;
    end if;
  end if;
  return old;
end;
$function$;

-- The triggers themselves were not changed by the migration; for reference:
--   order_items_after_insert_book_stock  AFTER INSERT ... EXECUTE FUNCTION trg_order_item_book_stock()
--   order_items_after_status_update      AFTER UPDATE ... EXECUTE FUNCTION trg_order_item_status_change()
--   order_items_after_delete_unbook      AFTER DELETE ... EXECUTE FUNCTION trg_order_item_delete_unbook()

drop function if exists private.apply_item_effect(integer, integer, integer, numeric, boolean, integer);
drop function if exists private.order_is_real(integer);

-- New objects ---------------------------------------------------------------

drop function if exists public.record_sorting(integer, integer, integer, integer, bigint, text);
drop function if exists public.delete_sorting(bigint);
drop function if exists public.save_shipment(jsonb, jsonb);
drop function if exists public.validate_shipment(bigint);
drop function if exists public.delete_shipment(bigint);
drop table if exists public.stock_sortings;
drop table if exists public.shipment_items;
drop table if exists public.shipments;

drop trigger if exists products_stock_rows on public.products;
drop trigger if exists products_stock_rows_update on public.products;
drop function if exists private.trg_products_stock_rows();
drop function if exists private.rebook_product(integer);

-- stocks: merge grades into the AB row, then drop the grade ------------------

update public.stocks s
set stock = t.stock,
    booked_stock = t.booked_stock
from (
  select product_id, sum(stock) as stock, sum(booked_stock) as booked_stock
  from public.stocks
  group by product_id
) t
where s.product_id = t.product_id and s.category_id = 2;

delete from public.stocks where category_id <> 2;

drop index if exists public.stocks_product_category_key;
alter table public.stocks drop constraint if exists stocks_category_id_check;
alter table public.stocks drop column if exists category_id;
alter table public.stocks add constraint stocks_product_id_key unique (product_id);

drop function if exists private.adjust_stock(integer, integer, numeric, numeric);
drop function if exists public.ensure_stock_rows(integer);
drop function if exists public.stock_category_for(integer, integer);
drop function if exists public.is_gradable(integer);

-- coming_wares (empty), original DDL -----------------------------------------

create table if not exists public.coming_wares (
  id bigint generated by default as identity primary key,
  expected_delivery date,
  comment text,
  total_quantity numeric,
  name text,
  all_for_order boolean default false,
  verified boolean default false
);

create table if not exists public.coming_wares_items (
  id bigint generated by default as identity primary key,
  order_id bigint not null references public.coming_wares (id),
  product_id integer not null references public.products (id),
  category integer not null references public.categories (id),
  quantity numeric not null,
  is_correct boolean,
  comment text,
  for_order boolean default false
);

alter table public.coming_wares enable row level security;
alter table public.coming_wares_items enable row level security;

create policy "Approved users can read" on public.coming_wares
  for select to authenticated using ((select private.is_approved()));
create policy "Admins can insert" on public.coming_wares
  for insert to authenticated with check ((select private.is_admin()));
create policy "Approved users can update" on public.coming_wares
  for update to authenticated
  using ((select private.is_approved())) with check ((select private.is_approved()));
create policy "Approved users can delete" on public.coming_wares
  for delete to authenticated using ((select private.is_approved()));

create policy "Approved users have full access" on public.coming_wares_items
  for all to authenticated
  using ((select private.is_approved())) with check ((select private.is_approved()));

create or replace function public.place_coming_wares(p_wares jsonb, p_items jsonb)
returns bigint
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
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
$function$;

create or replace function public.verify_coming_wares(p_wares_id bigint)
returns void
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
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
$function$;

create or replace function public.delete_coming_wares(p_wares_id bigint)
returns void
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  delete from public.coming_wares_items where order_id = p_wares_id;
  delete from public.coming_wares where id = p_wares_id;
end;
$function$;

revoke execute on function
  public.place_coming_wares(jsonb, jsonb),
  public.verify_coming_wares(bigint),
  public.delete_coming_wares(bigint)
from public, anon;
grant execute on function
  public.place_coming_wares(jsonb, jsonb),
  public.verify_coming_wares(bigint),
  public.delete_coming_wares(bigint)
to authenticated, service_role;

-- Legacy stock RPCs dropped by the migration (original bodies) --------------

create or replace function public.add_to_product_stock(p_product_id bigint, p_amount integer)
returns boolean
language plpgsql
as $function$
begin
  update stocks set stock = stock + p_amount where product_id = p_product_id;
  if found then return true; else return false; end if;
end;
$function$;

create or replace function public.product_booked_stock_sold(p_product_id bigint, p_amount integer)
returns boolean
language plpgsql
as $function$
begin
  update stocks set stock = stock - p_amount, booked_stock = booked_stock - p_amount
  where product_id = p_product_id;
  if found then return true; else return false; end if;
end;
$function$;

commit;
