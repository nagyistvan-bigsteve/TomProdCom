-- Deleted orders: who may delete, what happens to their stock, and when they
-- are purged.
--
-- 1. Only admins may soft-delete or restore an order (orders.deleted_at with
--    just_offer = false). Any approved user may soft-delete an offer (loading
--    an offer into the cart with "delete the offer" does this); restoring one
--    is admin-only, like the Deleted page.
-- 2. A soft-deleted order no longer books stock: deleting it releases the
--    bookings of its undelivered items, restoring it books them again.
--    Delivered items stay deducted, as for a permanent delete. Items of a
--    deleted order have no stock effect (order_is_real), so the permanent
--    delete later does not release them a second time.
-- 3. Orders and offers deleted more than 10 days ago are purged every night
--    by pg_cron (until now the Deleted page did it when an admin opened it).
-- 4. booked_stock is recomputed once without deleted orders.
--
-- Run after 20261123180000_graded_stock_hardening.sql. Undo with
-- supabase/rollbacks/deleted_orders_stock_rollback.sql.

-- 2. deleted orders have no stock effect --------------------------------------

create or replace function private.order_is_real(p_order_id integer)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select coalesce((select not coalesce(o.just_offer, false) and o.deleted_at is null
                   from public.orders o where o.id = p_order_id), false);
$$;

create or replace function private.rebook_product(p_product_id integer)
returns void
language plpgsql
-- definer since 20261123180000: stocks is read-only for the API role
security definer
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
      and o.deleted_at is null
      and not coalesce(i.item_status, false)
      and public.stock_category_for(i.product_id, i.category_id) = s.category_id
  ), 0)
  where s.product_id = p_product_id;
end;
$$;

-- converting a deleted offer (or turning a deleted order back) moves nothing
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
  if new.deleted_at is not null then
    return null;
  end if;

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

-- soft delete releases the undelivered items' bookings, restore books them
create or replace function private.trg_order_deleted_stock()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_sign integer := case when new.deleted_at is null then 1 else -1 end;
  r record;
begin
  if coalesce(new.just_offer, false) then
    return null;
  end if;

  for r in
    select product_id, category_id, quantity
    from public.order_items
    where order_id = new.id and not coalesce(item_status, false)
    order by product_id, id
  loop
    perform private.item_stock_effect(r.product_id, r.category_id, r.quantity, false, v_sign);
  end loop;

  return null;
end;
$$;

revoke execute on function private.trg_order_deleted_stock() from public, anon;
grant execute on function private.trg_order_deleted_stock() to authenticated, service_role;

drop trigger if exists orders_deleted_stock on public.orders;

create trigger orders_deleted_stock
  after update of deleted_at on public.orders
  for each row
  when ((old.deleted_at is null) is distinct from (new.deleted_at is null))
  execute function private.trg_order_deleted_stock();

-- 1. who may delete and restore -------------------------------------------------

create or replace function private.guard_order_deletion()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- no signed-in user: dashboard, service role or the nightly purge
  if (select auth.uid()) is null then
    return new;
  end if;

  if (select private.is_admin()) then
    return new;
  end if;

  if not coalesce(old.just_offer, false) then
    raise exception 'Only admins can delete or restore an order' using errcode = '42501';
  end if;

  if new.deleted_at is null then
    raise exception 'Only admins can restore an offer' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function private.guard_order_deletion() from public, anon;
grant execute on function private.guard_order_deletion() to authenticated, service_role;

drop trigger if exists orders_guard_deletion on public.orders;

create trigger orders_guard_deletion
  before update of deleted_at on public.orders
  for each row
  when (old.deleted_at is distinct from new.deleted_at)
  execute function private.guard_order_deletion();

-- 3. nightly purge ------------------------------------------------------------

create or replace function private.purge_deleted_orders()
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  -- items of a deleted order have no stock effect any more (order_is_real)
  delete from public.order_items i
  using public.orders o
  where o.id = i.order_id and o.deleted_at < now() - interval '10 days';

  delete from public.orders where deleted_at < now() - interval '10 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function private.purge_deleted_orders() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- 02:30 UTC; scheduling the same name again replaces the job
select cron.schedule('purge-deleted-orders', '30 2 * * *', 'select private.purge_deleted_orders()');

-- 4. repair -----------------------------------------------------------------

select private.rebook_product(p.id) from public.products p where p.unit_id <> 2;
