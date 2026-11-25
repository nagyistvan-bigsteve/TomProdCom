-- New orders and offers get an admin sort position at the end of the list
-- (SPEC.md §8.9 "Admin sort"). public.assign_default_sort_order() existed but
-- no trigger called it, so every new row had sort_order = NULL and sorted as 0
-- (top of the admin sort).
--
-- Also numbers the rows that are still NULL, after the numbered ones, by
-- expected delivery and then id. Rows that already have a position keep it.
--
-- Undo: supabase/rollbacks/orders_default_sort_order_rollback.sql

begin;

create or replace function public.assign_default_sort_order()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.sort_order is null then
    new.sort_order := coalesce((select max(sort_order) from orders) + 1, 1);
  end if;
  return new;
end;
$$;

drop trigger if exists orders_default_sort_order on public.orders;

create trigger orders_default_sort_order
before insert on public.orders
for each row
execute function public.assign_default_sort_order();

with base as (
  select coalesce(max(sort_order), 0) as top from public.orders
),
numbered as (
  select id, row_number() over (order by expected_delivery nulls last, id) as n
  from public.orders
  where sort_order is null
)
update public.orders o
set sort_order = base.top + numbered.n
from numbered, base
where o.id = numbered.id;

commit;
