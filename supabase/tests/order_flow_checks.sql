-- Order / offer write-path checks for staging. Self-contained: creates its own
-- ZZTEST client, product, orders and sign-up, and ends with RAISE EXCEPTION, so
-- EVERYTHING is rolled back. The "error" message is the test report: every line
-- should start with "ok". Look for "FAIL".
--
-- Covers what graded_stock_checks.sql does not: place_order (offer, order,
-- "delete the offer"), the order item RPCs and their totals, soft delete /
-- restore and who may do it, mark delivered, the 10-day purge, permanent
-- delete and deny_user. Run it before and after changing any of these
-- functions; both runs must be all "ok".
--
-- Needs at least one approved user who is not an admin and one approved admin.
do $test$
declare
  v_user uuid; v_admin uuid; v_deny uuid;
  v_client int; p int; v_offer int; v_order int; v_order2 int; v_item int;
  v_totals jsonb := '{"total_amount": 1100, "total_amount_final": 990, "total_quantity": 0}';
  r text := '';
begin
  select pr.id into v_user from profiles pr
  where pr.approved and not exists (select 1 from admin_users a where a.id = pr.id)
  order by pr.id limit 1;
  select pr.id into v_admin from profiles pr join admin_users a on a.id = pr.id
  where pr.approved order by pr.id limit 1;
  if v_user is null or v_admin is null then
    raise exception 'order_flow_checks needs an approved non-admin user and an approved admin';
  end if;

  execute $q$create function pg_temp.chk(l text, a text, e text) returns text language sql as $f$
    select case when a is not distinct from e then 'ok   ' else 'FAIL ' end || l || ': ' || coalesce(a,'null')
      || case when a is distinct from e then ' (expected ' || coalesce(e,'null') || ')' else '' end || chr(10) $f$ $q$;
  execute $q$create function pg_temp.st(p int, c int) returns text language sql as $f$
    select coalesce((select stock::text || '/' || booked_stock::text from public.stocks where product_id = p and category_id = c), 'none') $f$ $q$;
  -- act as a signed-in user: auth.uid(), is_admin() and the guard triggers read this
  execute $q$create function pg_temp.act(u uuid) returns void language sql as $f$
    select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true) $f$ $q$;
  -- the SQLSTATE a statement fails with, or 'no error'
  execute $q$create function pg_temp.err(stmt text) returns text language plpgsql as $f$
    begin execute stmt; return 'no error'; exception when others then return sqlstate; end $f$ $q$;

  insert into clients (type, name, code)
  values (1, 'ZZTEST order flow', 'ZZTEST-' || left(gen_random_uuid()::text, 8))
  returning id into v_client;
  insert into products (name, unit_id, length) values ('ZZTEST order flow 400', 1, 400) returning id into p;
  update stocks set stock = 100 where product_id = p and category_id = 1;

  perform pg_temp.act(v_user);

  r := r || '-- place_order' || chr(10);
  v_offer := place_order(
    jsonb_build_object('client_id', v_client, 'just_offer', true, 'total_amount', 250, 'total_amount_final', 250),
    jsonb_build_array(jsonb_build_object('product_id', p, 'quantity', 5, 'category_id', 1, 'price', 250)));
  r := r || pg_temp.chk('an offer books nothing', pg_temp.st(p, 1), '100/0');
  r := r || pg_temp.chk('operator is the caller', (select operator_id::text from orders where id = v_offer), v_user::text);
  r := r || pg_temp.chk('an order without items is refused',
    pg_temp.err(format('select place_order(%L::jsonb, %L::jsonb)', jsonb_build_object('client_id', v_client), '[]')), '22023');

  v_order := place_order(
    jsonb_build_object('client_id', v_client, 'just_offer', false, 'total_amount', 1000, 'total_amount_final', 900),
    jsonb_build_array(
      jsonb_build_object('product_id', p, 'quantity', 3, 'category_id', 1, 'price', 600),
      jsonb_build_object('product_id', p, 'quantity', 2, 'category_id', 3, 'price', 400)),
    v_offer);
  r := r || pg_temp.chk('an order books its grades (A, B)', pg_temp.st(p, 1) || ' ' || pg_temp.st(p, 3), '100/3 0/2');
  r := r || pg_temp.chk('totals saved as sent', (select total_amount || '/' || total_amount_final from orders where id = v_order), '1000/900');
  r := r || pg_temp.chk('the replaced offer is soft-deleted', (select (deleted_at is not null)::text from orders where id = v_offer), 'true');

  v_order2 := place_order(
    jsonb_build_object('client_id', v_client),
    jsonb_build_array(jsonb_build_object('product_id', p, 'quantity', 1, 'category_id', 1, 'price', 200)),
    v_order);
  r := r || pg_temp.chk('an order is never deleted as "the offer"', (select (deleted_at is null)::text from orders where id = v_order), 'true');
  r := r || pg_temp.chk('just_offer defaults to an order', pg_temp.st(p, 1), '100/4');

  r := r || '-- order item RPCs' || chr(10);
  v_item := add_order_item(v_order, jsonb_build_object('product_id', p, 'quantity', 2, 'category_id', 1, 'price', 400), v_totals);
  r := r || pg_temp.chk('add item books', pg_temp.st(p, 1), '100/6');
  r := r || pg_temp.chk('add item saves the totals', (select total_amount || '/' || total_amount_final from orders where id = v_order), '1100/990');
  perform update_order_item(v_item, '{"quantity": 4}', v_totals);
  r := r || pg_temp.chk('quantity change rebooks', pg_temp.st(p, 1), '100/8');
  perform update_order_item(v_item, '{"category_id": 3}', v_totals);
  r := r || pg_temp.chk('grade change moves the booking', pg_temp.st(p, 1) || ' ' || pg_temp.st(p, 3), '100/4 0/6');
  r := r || pg_temp.chk('re-pricing a line of another order is refused',
    pg_temp.err(format('select update_order_item_prices(%s, %L::jsonb, %L::jsonb)', v_order2,
      jsonb_build_array(jsonb_build_object('id', v_item, 'price', 1)), v_totals)), 'P0002');
  perform update_order_item_prices(v_order, jsonb_build_array(jsonb_build_object('id', v_item, 'price', 77)),
    '{"total_amount": 777, "total_amount_final": 700, "total_quantity": 0}');
  r := r || pg_temp.chk('re-pricing saves price and totals',
    (select price::text from order_items where id = v_item) || ' ' || (select total_amount || '/' || total_amount_final from orders where id = v_order),
    '77 777/700');
  perform delete_order_item(v_item, v_totals);
  r := r || pg_temp.chk('delete item unbooks', pg_temp.st(p, 1) || ' ' || pg_temp.st(p, 3), '100/4 0/2');

  r := r || '-- soft delete and restore' || chr(10);
  r := r || pg_temp.chk('a user cannot delete an order',
    pg_temp.err(format('update orders set deleted_at = now() where id = %s', v_order)), '42501');
  r := r || pg_temp.chk('a user cannot restore an offer',
    pg_temp.err(format('update orders set deleted_at = null where id = %s', v_offer)), '42501');
  perform pg_temp.act(v_admin);
  update orders set deleted_at = now() where id = v_order;
  r := r || pg_temp.chk('a deleted order releases its bookings', pg_temp.st(p, 1) || ' ' || pg_temp.st(p, 3), '100/1 0/0');
  update orders set deleted_at = null where id = v_order;
  r := r || pg_temp.chk('a restored order books again', pg_temp.st(p, 1) || ' ' || pg_temp.st(p, 3), '100/4 0/2');

  r := r || '-- delivered' || chr(10);
  perform mark_order_delivered(v_order);
  r := r || pg_temp.chk('stock leaves, bookings released (B may go negative)',
    pg_temp.st(p, 1) || ' ' || pg_temp.st(p, 3), '97/1 -2/0');
  r := r || pg_temp.chk('every line and the order are delivered',
    (select bool_and(item_status)::text from order_items where order_id = v_order) || ' '
      || (select (date_order_delivered is not null)::text from orders where id = v_order),
    'true true');

  r := r || '-- purge after 10 days, permanent delete' || chr(10);
  update orders set deleted_at = now() - interval '11 days' where id = v_offer;
  update orders set deleted_at = now() - interval '9 days' where id = v_order2;
  r := r || pg_temp.chk('deleting the second order unbooks it', pg_temp.st(p, 1), '97/0');
  perform private.purge_deleted_orders();
  r := r || pg_temp.chk('deleted 11 days ago: purged with its lines',
    (select count(*)::text from orders where id = v_offer) || '/' || (select count(*)::text from order_items where order_id = v_offer), '0/0');
  r := r || pg_temp.chk('deleted 9 days ago: kept', (select count(*)::text from orders where id = v_order2), '1');
  perform delete_order_permanently(v_order2);
  r := r || pg_temp.chk('permanent delete removes order and lines',
    (select count(*)::text from orders where id = v_order2) || '/' || (select count(*)::text from order_items where order_id = v_order2), '0/0');
  r := r || pg_temp.chk('stock untouched by deleting a deleted order', pg_temp.st(p, 1), '97/0');

  r := r || '-- deny_user' || chr(10);
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
          'zztest-deny-' || left(gen_random_uuid()::text, 8) || '@example.invalid', '{"name": "ZZTEST"}', now(), now())
  returning id into v_deny;
  r := r || pg_temp.chk('a sign-up gets an unapproved user profile',
    (select role || '/' || approved::text from profiles where id = v_deny), 'user/false');
  perform pg_temp.act(v_user);
  r := r || pg_temp.chk('a user cannot deny', pg_temp.err(format('select deny_user(%L)', v_deny)), '42501');
  perform pg_temp.act(v_admin);
  r := r || pg_temp.chk('an approved user cannot be denied', pg_temp.err(format('select deny_user(%L)', v_user)), '42501');
  r := r || pg_temp.chk('an admin cannot deny themself', pg_temp.err(format('select deny_user(%L)', v_admin)), '42501');
  perform deny_user(v_deny);
  r := r || pg_temp.chk('denied: profile and sign-in account gone',
    (select count(*)::text from profiles where id = v_deny) || '/' || (select count(*)::text from auth.users where id = v_deny), '0/0');

  raise exception 'TEST REPORT (rolled back)%', chr(10) || r;
end;
$test$;
