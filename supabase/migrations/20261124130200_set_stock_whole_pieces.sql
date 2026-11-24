-- Hand stock edit: whole numbers for products counted in pieces.
--
-- Stock of a BUC or bundle product, and of an M3 product with a width, is a
-- number of pieces (bundles); set_stock accepted 8.5 of them. It now refuses
-- a fraction for those products (SA008). M3 products without a width are
-- sold by volume (stock in m³) and M2 products in m², so they keep decimals.
-- The rule is mirrored by countsWholePieces() in @shared/utils/stock.util.
--
-- Undo with supabase/rollbacks/set_stock_whole_pieces_rollback.sql.

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

  if p_new <> trunc(p_new) and exists (
    select 1 from public.products p
    where p.id = v.product_id
      and (p.unit_id in (1, 4) or (p.unit_id = 3 and p.width is not null))
  ) then
    raise exception 'Stock of product % is counted in whole pieces', v.product_id
      using errcode = 'SA008';
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
