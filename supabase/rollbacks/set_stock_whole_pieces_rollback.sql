-- Emergency undo of migrations/20261124130200_set_stock_whole_pieces.sql:
-- set_stock as defined in 20261123180000_graded_stock_hardening.sql.
-- The app keeps working with it (it checks whole pieces itself).

begin;

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

commit;
