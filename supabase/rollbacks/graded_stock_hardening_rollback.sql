-- Emergency undo of migrations/20261123180000_graded_stock_hardening.sql.
--
-- Reopens direct writes to shipments / shipment_items / stock_sortings for
-- approved users (the policy before the hardening), turns the RPCs back into
-- security invoker functions and removes set_stock, stock_adjustments and
-- shipments_with_remaining.
--
-- Kept on purpose (harmless with the older app and RPC behaviour):
--   * the RPC bodies (approved check, explicit created_by, SA007 draft check
--     that only applies when the app sends updated_at, the M2 check in
--     validate_shipment, the stock row lock in delete_sorting);
--   * shipments.updated_at, the profiles foreign keys, the new index;
--   * the products trigger recounting bookings for every unit (M2 → 0).
-- The app must be rolled back too: it calls set_stock and
-- shipments_with_remaining.

begin;

do $$
declare
  t text;
begin
  foreach t in array array['shipments', 'shipment_items', 'stock_sortings'] loop
    execute format('drop policy if exists "Approved users can read" on public.%I', t);
    execute format('drop policy if exists "Approved users have full access" on public.%I', t);
    execute format(
      'create policy "Approved users have full access" on public.%I
         for all to authenticated
         using ((select private.is_approved()))
         with check ((select private.is_approved()))', t);
  end loop;
end;
$$;

-- stocks writable by approved users again (RLS policy unchanged)
grant insert, update, delete on public.stocks to authenticated;
grant execute on function public.ensure_stock_rows(integer) to authenticated;
alter function private.adjust_stock(integer, integer, numeric, numeric) security invoker;
alter function public.ensure_stock_rows(integer) security invoker;
alter function private.rebook_product(integer) security invoker;
alter function private.trg_products_stock_rows() security invoker;

alter function public.save_shipment(jsonb, jsonb) security invoker;
alter function public.validate_shipment(bigint) security invoker;
alter function public.delete_shipment(bigint) security invoker;
alter function public.record_sorting(integer, integer, integer, integer, bigint, text) security invoker;
alter function public.delete_sorting(bigint) security invoker;

drop function if exists public.set_stock(bigint, numeric, numeric);
drop function if exists public.shipments_with_remaining(integer);
drop table if exists public.stock_adjustments;

commit;
