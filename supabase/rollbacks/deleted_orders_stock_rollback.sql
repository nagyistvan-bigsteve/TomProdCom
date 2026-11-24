-- Emergency undo of migrations/20261124130000_deleted_orders_stock.sql.
--
-- Removes the deletion guard and the soft-delete booking trigger, stops the
-- nightly purge and restores order_is_real, rebook_product and the offer
-- conversion trigger as they were. booked_stock is recomputed with deleted
-- orders counted again (the behaviour before the migration). The pg_cron
-- extension itself is left enabled.
-- The app must be rolled back too: the Deleted page no longer purges.

begin;

do $$
begin
  if to_regprocedure('public.set_stock(bigint, numeric, numeric)') is not null
     and exists (
       select 1 from pg_proc
       where oid = 'public.set_stock(bigint, numeric, numeric)'::regprocedure
         and prosrc like '%SA008%'
     ) then
    raise exception 'Run set_stock_whole_pieces_rollback.sql first';
  end if;
end;
$$;

drop trigger if exists orders_guard_deletion on public.orders;
drop function if exists private.guard_order_deletion();

drop trigger if exists orders_deleted_stock on public.orders;
drop function if exists private.trg_order_deleted_stock();

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from cron.job where jobname = 'purge-deleted-orders') then
    perform cron.unschedule('purge-deleted-orders');
  end if;
end;
$$;

drop function if exists private.purge_deleted_orders();

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

create or replace function private.rebook_product(p_product_id integer)
returns void
language plpgsql
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
      and not coalesce(i.item_status, false)
      and public.stock_category_for(i.product_id, i.category_id) = s.category_id
  ), 0)
  where s.product_id = p_product_id;
end;
$$;

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

select private.rebook_product(p.id) from public.products p where p.unit_id <> 2;

commit;
