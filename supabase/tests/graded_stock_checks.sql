-- Graded stock checks for staging. Self-contained: creates its own ZZTEST
-- products, orders and shipments, and ends with RAISE EXCEPTION, so
-- EVERYTHING is rolled back. The "error" message is the test report:
-- every line should start with "ok". Look for "FAIL".
-- Needs migrations 20261123152149_graded_stock and
-- 20261123163000_offer_conversion_booking (or their renamed versions).
do $test$
declare
  pa int; pb int; pl int; pm int; o int; o2 int; o3 int;
  i1 int; i2 int; i3 int; i4 int; i5 int; i6 int; i7 int; i8 int;
  sh bigint; sh2 bigint; so1 bigint; so2 bigint;
  v_admin uuid;
  r text := '';
begin
  execute $q$create function pg_temp.chk(l text, a text, e text) returns text language sql as $f$
    select case when a is not distinct from e then 'ok   ' else 'FAIL ' end || l || ': ' || coalesce(a,'null')
      || case when a is distinct from e then ' (expected ' || coalesce(e,'null') || ')' else '' end || chr(10) $f$ $q$;
  execute $q$create function pg_temp.st(p int, c int) returns text language sql as $f$
    select coalesce((select stock::text || '/' || booked_stock::text from public.stocks where product_id = p and category_id = c), 'none') $f$ $q$;

  -- products: insert trigger creates rows
  insert into products (name, unit_id, length) values ('ZZTEST 400', 1, 400) returning id into pa;
  insert into products (name, unit_id, length) values ('ZZTEST 700', 1, 700) returning id into pb;
  insert into products (name, unit_id, length) values ('ZZTEST 800', 1, 800) returning id into pl;
  insert into products (name, unit_id, length) values ('ZZTEST m2', 2, 250) returning id into pm;
  r := r || '-- product insert creates stock rows' || chr(10);
  r := r || pg_temp.chk('400cm grades', (select string_agg(category_id::text, ',' order by category_id) from stocks where product_id = pa), '1,2,3');
  r := r || pg_temp.chk('700cm grades (boundary)', (select string_agg(category_id::text, ',' order by category_id) from stocks where product_id = pb), '1,2,3');
  r := r || pg_temp.chk('800cm grades', (select string_agg(category_id::text, ',' order by category_id) from stocks where product_id = pl), '2');
  r := r || pg_temp.chk('M2 grades', (select string_agg(category_id::text, ',' order by category_id) from stocks where product_id = pm), '2');

  update stocks set stock = case category_id when 1 then 100 when 2 then 50 else 20 end where product_id = pa;
  update stocks set stock = 30 where product_id = pl;
  insert into orders (client_id, just_offer) values (1, false) returning id into o;
  insert into orders (client_id, just_offer) values (1, true) returning id into o2;

  r := r || '-- A item (pa: A 100, AB 50, B 20)' || chr(10);
  insert into order_items (order_id, product_id, category_id, quantity, item_status) values (o, pa, 1, 5, false) returning id into i1;
  r := r || pg_temp.chk('book A', pg_temp.st(pa,1), '100/5');
  update order_items set item_status = true where id = i1;
  r := r || pg_temp.chk('deliver A', pg_temp.st(pa,1), '95/0');
  update order_items set item_status = false where id = i1;
  r := r || pg_temp.chk('undeliver A', pg_temp.st(pa,1), '100/5');
  delete from order_items where id = i1;
  r := r || pg_temp.chk('delete A', pg_temp.st(pa,1), '100/0');

  r := r || '-- T item (from A)' || chr(10);
  insert into order_items (order_id, product_id, category_id, quantity, item_status) values (o, pa, 4, 7, false) returning id into i2;
  r := r || pg_temp.chk('book T -> A', pg_temp.st(pa,1), '100/7');
  r := r || pg_temp.chk('book T leaves AB', pg_temp.st(pa,2), '50/0');
  update order_items set item_status = true where id = i2;
  r := r || pg_temp.chk('deliver T -> A', pg_temp.st(pa,1), '93/0');
  update order_items set item_status = false where id = i2;
  r := r || pg_temp.chk('undeliver T', pg_temp.st(pa,1), '100/7');
  delete from order_items where id = i2;
  r := r || pg_temp.chk('delete T', pg_temp.st(pa,1), '100/0');

  r := r || '-- AB item' || chr(10);
  insert into order_items (order_id, product_id, category_id, quantity, item_status) values (o, pa, 2, 4, false) returning id into i3;
  r := r || pg_temp.chk('book AB', pg_temp.st(pa,2), '50/4');
  update order_items set item_status = true where id = i3;
  r := r || pg_temp.chk('deliver AB', pg_temp.st(pa,2), '46/0');
  update order_items set item_status = false where id = i3;
  r := r || pg_temp.chk('undeliver AB', pg_temp.st(pa,2), '50/4');
  delete from order_items where id = i3;
  r := r || pg_temp.chk('delete AB', pg_temp.st(pa,2), '50/0');
  r := r || pg_temp.chk('A untouched by AB item', pg_temp.st(pa,1), '100/0');

  r := r || '-- >7 m item sold as A (pl: AB 30)' || chr(10);
  insert into order_items (order_id, product_id, category_id, quantity, item_status) values (o, pl, 1, 3, false) returning id into i4;
  r := r || pg_temp.chk('book long A -> AB', pg_temp.st(pl,2), '30/3');
  update order_items set item_status = true where id = i4;
  r := r || pg_temp.chk('deliver long', pg_temp.st(pl,2), '27/0');
  update order_items set item_status = false where id = i4;
  r := r || pg_temp.chk('undeliver long', pg_temp.st(pl,2), '30/3');
  delete from order_items where id = i4;
  r := r || pg_temp.chk('delete long', pg_temp.st(pl,2), '30/0');
  insert into order_items (order_id, product_id, category_id, quantity, item_status) values (o, pl, 4, 2, false) returning id into i4;
  r := r || pg_temp.chk('book long T -> AB', pg_temp.st(pl,2), '30/2');
  delete from order_items where id = i4;
  r := r || pg_temp.chk('long rows still only AB', (select count(*)::text from stocks where product_id = pl), '1');

  r := r || '-- B item, delivered delete, offer, M2, negative' || chr(10);
  insert into order_items (order_id, product_id, category_id, quantity, item_status) values (o, pa, 3, 2, false) returning id into i5;
  r := r || pg_temp.chk('book B', pg_temp.st(pa,3), '20/2');
  delete from order_items where id = i5;
  insert into order_items (order_id, product_id, category_id, quantity, item_status) values (o, pa, 1, 10, false) returning id into i5;
  update order_items set item_status = true where id = i5;
  delete from order_items where id = i5;
  r := r || pg_temp.chk('delete delivered keeps deduction', pg_temp.st(pa,1), '90/0');
  update stocks set stock = 100 where product_id = pa and category_id = 1;
  insert into order_items (order_id, product_id, category_id, quantity, item_status) values (o2, pa, 1, 5, false) returning id into i5;
  update order_items set item_status = true where id = i5;
  r := r || pg_temp.chk('offer item ignored', pg_temp.st(pa,1), '100/0');
  delete from order_items where id = i5;
  insert into order_items (order_id, product_id, category_id, quantity, item_status) values (o, pm, 1, 5, false) returning id into i5;
  update order_items set item_status = true where id = i5;
  r := r || pg_temp.chk('M2 item ignored', pg_temp.st(pm,2), '0/0');
  delete from order_items where id = i5;
  insert into order_items (order_id, product_id, category_id, quantity, item_status) values (o, pa, 1, 500, false) returning id into i7;
  update order_items set item_status = true where id = i7;
  r := r || pg_temp.chk('negative A allowed', pg_temp.st(pa,1), '-400/0');
  delete from order_items where id = i7;
  update stocks set stock = 100 where product_id = pa and category_id = 1;

  r := r || '-- category / quantity change on booked item' || chr(10);
  insert into order_items (order_id, product_id, category_id, quantity, item_status) values (o, pa, 1, 6, false) returning id into i6;
  r := r || pg_temp.chk('book A 6', pg_temp.st(pa,1), '100/6');
  update order_items set category_id = 3 where id = i6;
  r := r || pg_temp.chk('A->B: A', pg_temp.st(pa,1), '100/0');
  r := r || pg_temp.chk('A->B: B', pg_temp.st(pa,3), '20/6');
  update order_items set quantity = 9 where id = i6;
  r := r || pg_temp.chk('qty 6->9: B', pg_temp.st(pa,3), '20/9');
  update order_items set category_id = 4 where id = i6;
  r := r || pg_temp.chk('B->T: A', pg_temp.st(pa,1), '100/9');
  r := r || pg_temp.chk('B->T: B', pg_temp.st(pa,3), '20/0');
  update order_items set price = 123 where id = i6;
  r := r || pg_temp.chk('price-only update no-op', pg_temp.st(pa,1), '100/9');
  update order_items set item_status = true where id = i6;
  r := r || pg_temp.chk('deliver T 9', pg_temp.st(pa,1), '91/0');
  update order_items set category_id = 2 where id = i6;
  r := r || pg_temp.chk('delivered T->AB: A restored', pg_temp.st(pa,1), '100/0');
  r := r || pg_temp.chk('delivered T->AB: AB deducted', pg_temp.st(pa,2), '41/0');
  delete from order_items where id = i6;
  update stocks set stock = 50 where product_id = pa and category_id = 2;

  r := r || '-- shipments' || chr(10);
  sh := public.save_shipment(jsonb_build_object('name', 'ZZTEST truck', 'arrived_on', '2026-11-23'),
         jsonb_build_array(jsonb_build_object('product_id', pa, 'quantity', 10),
                           jsonb_build_object('product_id', pl, 'quantity', 5),
                           jsonb_build_object('product_id', pa, 'quantity', 2)));
  r := r || pg_temp.chk('draft lines summed', (select string_agg(product_id || ':' || quantity, ',' order by product_id) from shipment_items where shipment_id = sh), pa || ':12,' || pl || ':5');
  perform public.save_shipment(jsonb_build_object('id', sh, 'name', 'ZZTEST truck 2'),
         jsonb_build_array(jsonb_build_object('product_id', pa, 'quantity', 12), jsonb_build_object('product_id', pl, 'quantity', 6)));
  r := r || pg_temp.chk('draft re-save', (select name || ' ' || string_agg(product_id || ':' || quantity, ',' order by product_id) from shipment_items join shipments s on s.id = shipment_id where shipment_id = sh group by name), 'ZZTEST truck 2 ' || pa || ':12,' || pl || ':6');
  r := r || pg_temp.chk('draft does not touch stock', pg_temp.st(pa,2), '50/0');
  begin perform public.save_shipment('{"name":"x"}', jsonb_build_array(jsonb_build_object('product_id', pm, 'quantity', 1))); r := r || 'FAIL M2 line accepted' || chr(10);
  exception when others then r := r || pg_temp.chk('M2 line rejected', sqlstate, 'SA002'); end;
  begin perform public.save_shipment('{"name":"x"}', '[]'); r := r || 'FAIL empty shipment accepted' || chr(10);
  exception when others then r := r || pg_temp.chk('empty shipment rejected', sqlstate, '22023'); end;
  perform public.validate_shipment(sh);
  r := r || pg_temp.chk('validate: pa AB', pg_temp.st(pa,2), '62/0');
  r := r || pg_temp.chk('validate: pl AB', pg_temp.st(pl,2), '36/0');
  r := r || pg_temp.chk('validate: A untouched', pg_temp.st(pa,1), '100/0');
  begin perform public.validate_shipment(sh); r := r || 'FAIL second validate succeeded' || chr(10);
  exception when others then r := r || pg_temp.chk('validate twice raises', sqlstate, 'SA003'); end;
  r := r || pg_temp.chk('validate twice: AB unchanged', pg_temp.st(pa,2), '62/0');
  begin perform public.save_shipment(jsonb_build_object('id', sh, 'name', 'y'), jsonb_build_array(jsonb_build_object('product_id', pa, 'quantity', 1))); r := r || 'FAIL edit validated' || chr(10);
  exception when others then r := r || pg_temp.chk('edit validated raises', sqlstate, 'SA003'); end;
  begin perform public.delete_shipment(sh); r := r || 'FAIL delete validated' || chr(10);
  exception when others then r := r || pg_temp.chk('delete validated raises', sqlstate, 'SA003'); end;
  sh2 := public.save_shipment('{"name":"ZZTEST draft"}', jsonb_build_array(jsonb_build_object('product_id', pa, 'quantity', 1)));
  perform public.delete_shipment(sh2);
  r := r || pg_temp.chk('delete draft (+cascade lines)', (select count(*)::text from shipment_items where shipment_id = sh2), '0');

  r := r || '-- sorting (pa AB 62)' || chr(10);
  begin perform public.record_sorting(pa, 50, 10, 3); r := r || 'FAIL oversort accepted' || chr(10);
  exception when others then r := r || pg_temp.chk('sort 63 > AB 62 raises', sqlstate, 'SA001'); end;
  r := r || pg_temp.chk('oversort: AB unchanged', pg_temp.st(pa,2), '62/0');
  r := r || pg_temp.chk('oversort: no row', (select count(*)::text from stock_sortings where product_id = pa), '0');
  begin perform public.record_sorting(pl, 1, 0, 0); r := r || 'FAIL long product sorted' || chr(10);
  exception when others then r := r || pg_temp.chk('sort >7 m raises', sqlstate, 'SA002'); end;
  begin perform public.record_sorting(pa, 0, 0, 0); r := r || 'FAIL zero sort accepted' || chr(10);
  exception when others then r := r || pg_temp.chk('zero sort raises', sqlstate, '23514'); end;
  begin perform public.record_sorting(pa, -1, 5, 0); r := r || 'FAIL negative sort accepted' || chr(10);
  exception when others then r := r || pg_temp.chk('negative qty raises', sqlstate, '23514'); end;
  so1 := public.record_sorting(pa, 40, 9, 2, null, 'test');
  r := r || pg_temp.chk('sort 40A 9B 2W: A', pg_temp.st(pa,1), '140/0');
  r := r || pg_temp.chk('sort: B', pg_temp.st(pa,3), '29/0');
  r := r || pg_temp.chk('sort: AB', pg_temp.st(pa,2), '11/0');
  perform public.delete_sorting(so1);
  r := r || pg_temp.chk('undo sort: A', pg_temp.st(pa,1), '100/0');
  r := r || pg_temp.chk('undo sort: B', pg_temp.st(pa,3), '20/0');
  r := r || pg_temp.chk('undo sort: AB', pg_temp.st(pa,2), '62/0');
  r := r || pg_temp.chk('undo sort: row gone', (select count(*)::text from stock_sortings where id = so1), '0');
  so2 := public.record_sorting(pa, 5, 0, 0);
  update stocks set stock = 2 where product_id = pa and category_id = 1;
  begin perform public.delete_sorting(so2); r := r || 'FAIL undo with sold pieces' || chr(10);
  exception when others then r := r || pg_temp.chk('undo when A already sold raises', sqlstate, 'SA004'); end;
  r := r || pg_temp.chk('blocked undo: row kept', (select count(*)::text from stock_sortings where id = so2), '1');
  r := r || pg_temp.chk('blocked undo: AB unchanged', pg_temp.st(pa,2), '57/0');
  begin perform public.delete_sorting(-1); r := r || 'FAIL undo missing' || chr(10);
  exception when others then r := r || pg_temp.chk('undo missing raises', sqlstate, 'P0002'); end;

  r := r || '-- sorting from a truck (sh brought 12 of pa, AB 57)' || chr(10);
  begin perform public.record_sorting(pa, 10, 2, 1, sh); r := r || 'FAIL truck oversort accepted' || chr(10);
  exception when others then r := r || pg_temp.chk('sort 13 > 12 on truck raises', sqlstate, 'SA005'); end;
  perform public.record_sorting(pa, 8, 2, 0, sh);
  r := r || pg_temp.chk('truck sort 10: AB', pg_temp.st(pa,2), '47/0');
  begin perform public.record_sorting(pa, 3, 0, 0, sh); r := r || 'FAIL truck remainder exceeded' || chr(10);
  exception when others then r := r || pg_temp.chk('10 sorted + 3 > 12 raises', sqlstate, 'SA005'); end;
  perform public.record_sorting(pa, 2, 0, 0, sh);
  r := r || pg_temp.chk('truck fully sorted: AB', pg_temp.st(pa,2), '45/0');
  begin perform public.record_sorting(pb, 1, 0, 0, sh); r := r || 'FAIL product not on truck sorted' || chr(10);
  exception when others then r := r || pg_temp.chk('product not on truck raises', sqlstate, 'SA005'); end;
  update stocks set stock = 57 where product_id = pa and category_id = 2;

  r := r || '-- product becomes > 7 m' || chr(10);
  update stocks set stock = 10 where product_id = pa and category_id = 1;
  update stocks set stock = 5 where product_id = pa and category_id = 3;
  insert into order_items (order_id, product_id, category_id, quantity, item_status) values (o, pa, 1, 4, false);
  insert into order_items (order_id, product_id, category_id, quantity, item_status) values (o, pa, 4, 3, false);
  r := r || pg_temp.chk('before: A booked', pg_temp.st(pa,1), '10/7');
  update products set length = 800 where id = pa;
  r := r || pg_temp.chk('after: only AB row', (select string_agg(category_id::text, ',') from stocks where product_id = pa), '2');
  r := r || pg_temp.chk('after: AB merged + rebooked', pg_temp.st(pa,2), '72/7');

  r := r || '-- offer -> order conversion (pb: A 50, B 0)' || chr(10);
  update stocks set stock = 50 where product_id = pb and category_id = 1;
  insert into orders (client_id, just_offer) values (1, true) returning id into o3;
  insert into order_items (order_id, product_id, category_id, quantity, item_status) values (o3, pb, 1, 5, false) returning id into i8;
  insert into order_items (order_id, product_id, category_id, quantity, item_status) values (o3, pb, 4, 3, false);
  insert into order_items (order_id, product_id, category_id, quantity, item_status) values (o3, pb, 3, 2, true);
  r := r || pg_temp.chk('offer: nothing booked', pg_temp.st(pb,1) || ' ' || pg_temp.st(pb,3), '50/0 0/0');
  update orders set just_offer = false where id = o3;
  r := r || pg_temp.chk('convert: A + T booked', pg_temp.st(pb,1), '50/8');
  r := r || pg_temp.chk('convert: delivered B deducted', pg_temp.st(pb,3), '-2/0');
  update order_items set item_status = true where id = i8;
  r := r || pg_temp.chk('deliver after convert: booking released', pg_temp.st(pb,1), '45/3');
  update orders set comment = 'x' where id = o3;
  r := r || pg_temp.chk('other order update: no change', pg_temp.st(pb,1), '45/3');
  begin update orders set just_offer = true where id = o3; r := r || 'FAIL non-admin turned order into offer' || chr(10);
  exception when others then r := r || pg_temp.chk('order -> offer needs admin', sqlstate, '42501'); end;
  select a.id into v_admin from admin_users a join profiles p on p.id = a.id where p.approved limit 1;
  if v_admin is null then
    r := r || 'skip order -> offer as admin: no approved admin found' || chr(10);
  else
    perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);
    update orders set just_offer = true where id = o3;
    r := r || pg_temp.chk('admin order -> offer: A released', pg_temp.st(pb,1), '50/0');
    r := r || pg_temp.chk('admin order -> offer: B returned', pg_temp.st(pb,3), '0/0');
    perform set_config('request.jwt.claims', '', true);
  end if;

  raise exception 'TEST REPORT (rolled back)%', chr(10) || r;
end;
$test$;
