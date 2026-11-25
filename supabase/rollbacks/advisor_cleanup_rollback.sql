-- Emergency undo of migrations/20261125130000_advisor_cleanup.sql.
-- Run the first block on staging and production.

begin;

grant execute on function public.handle_new_user() to public, anon, authenticated;

alter function public.update_order_sort_orders(jsonb) reset search_path;

commit;

-- PRODUCTION ONLY. products_without_prices() existed only in production (never
-- in staging, and nothing in the app calls it). To bring it back on production,
-- run this block there as well; do not run it on staging, or staging gets a
-- function it never had. Recreated with a pinned search_path (CLAUDE.md rule).
--
-- create or replace function public.products_without_prices()
-- returns setof products
-- language sql
-- stable
-- set search_path = public
-- as $$
--   select distinct p.*
--   from stocks s
--   join products p on p.id = s.product_id
--   where p.unit_id != 3
--     and s.stock != 0
--     and not exists (
--       select 1
--       from prices_new pr
--       where pr.product_id = s.product_id
--         and pr.category_id = s.category_id
--     );
-- $$;
