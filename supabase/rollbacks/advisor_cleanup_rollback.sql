-- Emergency undo of migrations/20261125130000_advisor_cleanup.sql.
-- products_without_prices() is recreated as it was in production (it never
-- existed in staging).

begin;

grant execute on function public.handle_new_user() to public, anon, authenticated;

alter function public.update_order_sort_orders(jsonb) reset search_path;

create or replace function public.products_without_prices()
returns setof products
language sql
stable
as $$
  select distinct p.*
  from stocks s
  join products p on p.id = s.product_id
  where p.unit_id != 3
    and s.stock != 0
    and not exists (
      select 1
      from prices_new pr
      where pr.product_id = s.product_id
        and pr.category_id = s.category_id
    );
$$;

commit;
