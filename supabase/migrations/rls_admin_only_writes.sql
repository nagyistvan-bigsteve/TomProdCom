-- RLS step 2: enforce in the database what the UI already restricts to admins.
--
-- Run after rls_require_approved_user.sql. To relax only this step, re-run the
-- "Business and lookup tables" block of that file: it re-adds the "full access
-- for approved users" policy, which takes precedence over the ones below.
--
-- Not restricted on purpose:
--   stocks       - the order_items triggers update it on behalf of any user
--   order_items  - every user edits line items
--   soft delete  - it is a plain UPDATE of orders.deleted_at

-- Price list and product catalogue: edited only from the admin /settings page

do $$
declare
  t text;
begin
  foreach t in array array['prices_new', 'products'] loop
    execute format('drop policy if exists "Approved users have full access" on public.%I', t);
    execute format('drop policy if exists "Approved users can read" on public.%I', t);
    execute format('drop policy if exists "Admins can insert" on public.%I', t);
    execute format('drop policy if exists "Admins can update" on public.%I', t);
    execute format('drop policy if exists "Admins can delete" on public.%I', t);

    execute format(
      'create policy "Approved users can read" on public.%I
         for select to authenticated
         using ((select private.is_approved()))', t);
    execute format(
      'create policy "Admins can insert" on public.%I
         for insert to authenticated
         with check ((select private.is_admin()))', t);
    execute format(
      'create policy "Admins can update" on public.%I
         for update to authenticated
         using ((select private.is_admin()))
         with check ((select private.is_admin()))', t);
    execute format(
      'create policy "Admins can delete" on public.%I
         for delete to authenticated
         using ((select private.is_admin()))', t);
  end loop;
end;
$$;

-- Incoming shipments: only admins create them; everyone inspects and verifies

drop policy if exists "Approved users have full access" on public.coming_wares;
drop policy if exists "Approved users can read" on public.coming_wares;
drop policy if exists "Admins can insert" on public.coming_wares;
drop policy if exists "Approved users can update" on public.coming_wares;
drop policy if exists "Approved users can delete" on public.coming_wares;

create policy "Approved users can read" on public.coming_wares
  for select to authenticated
  using ((select private.is_approved()));

create policy "Admins can insert" on public.coming_wares
  for insert to authenticated
  with check ((select private.is_admin()));

create policy "Approved users can update" on public.coming_wares
  for update to authenticated
  using ((select private.is_approved()))
  with check ((select private.is_approved()));

create policy "Approved users can delete" on public.coming_wares
  for delete to authenticated
  using ((select private.is_approved()));

-- Orders: a real order can be hard-deleted only by an admin; offers by anyone

drop policy if exists "Approved users have full access" on public.orders;
drop policy if exists "Approved users can read" on public.orders;
drop policy if exists "Approved users can insert" on public.orders;
drop policy if exists "Approved users can update" on public.orders;
drop policy if exists "Admins delete orders, anyone deletes offers" on public.orders;

create policy "Approved users can read" on public.orders
  for select to authenticated
  using ((select private.is_approved()));

create policy "Approved users can insert" on public.orders
  for insert to authenticated
  with check ((select private.is_approved()));

create policy "Approved users can update" on public.orders
  for update to authenticated
  using ((select private.is_approved()))
  with check ((select private.is_approved()));

create policy "Admins delete orders, anyone deletes offers" on public.orders
  for delete to authenticated
  using (
    (select private.is_admin())
    or (just_offer and (select private.is_approved()))
  );

-- A delete blocked by the policy above removes zero rows without an error.
-- Fail loudly instead, so the line items deleted just before are rolled back.
create or replace function public.delete_order_permanently(p_order_id integer)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  delete from public.order_items where order_id = p_order_id;
  delete from public.orders where id = p_order_id;

  if not found then
    raise exception 'Order % was not deleted (missing or not allowed)', p_order_id
      using errcode = '42501';
  end if;
end;
$$;
