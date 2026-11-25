-- Clears Supabase security-advisor warnings that do not change app behaviour.
--
-- 1. handle_new_user() is the trigger on auth.users that creates a profile.
--    It is SECURITY DEFINER and was executable by anon/authenticated through
--    /rest/v1/rpc. Postgres refuses to run a trigger function outside a trigger,
--    so this was harmless, but nobody needs EXECUTE on it: a trigger does not
--    check EXECUTE when it fires.
-- 2. update_order_sort_orders() (admin drag-and-drop sort) had no pinned
--    search_path. Its body uses the unqualified table name "orders", so pin
--    public.
-- 3. products_without_prices() existed only in production and nothing calls
--    it. Dropped.
--
-- Undo: supabase/rollbacks/advisor_cleanup_rollback.sql

begin;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

alter function public.update_order_sort_orders(jsonb) set search_path = public;

drop function if exists public.products_without_prices();

commit;
