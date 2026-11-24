-- Emergency rollback of rls_require_approved_user.sql and
-- rls_admin_only_writes.sql: restores the previous open policies and grants.
--
-- WARNING: this makes every table readable and writable by anonymous callers
-- again. Use it only to get the app working while a policy problem is fixed.

do $$
declare
  t text;
  p record;
begin
  -- Drop every policy on the application tables
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'clients', 'client_phones', 'orders', 'order_items', 'products',
        'prices_new', 'stocks', 'coming_wares', 'coming_wares_items',
        'categories', 'units', 'sizes', 'client_type', 'admin_users', 'profiles'
      )
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;

  foreach t in array array[
    'clients', 'client_phones', 'orders', 'order_items', 'products',
    'prices_new', 'stocks', 'coming_wares', 'coming_wares_items',
    'categories', 'units', 'sizes', 'client_type', 'admin_users'
  ] loop
    execute format(
      'create policy "Enable access for all users" on public.%I for all to public using (true)',
      t
    );
  end loop;
end;
$$;

create policy "Admin can delete user" on public.profiles
  for delete to public
  using (exists (select 1 from public.admin_users where admin_users.id = auth.uid()));

create policy "Admin can view all profiles" on public.profiles
  for select to public
  using (exists (select 1 from public.admin_users where admin_users.id = auth.uid()));

create policy "Admins can update any profile" on public.profiles
  for update to public
  using (exists (select 1 from public.admin_users where admin_users.id = auth.uid()));

create policy "Allow only approved users" on public.profiles
  for select to public
  using (approved = true);

create policy "Allow user to read their own profile" on public.profiles
  for select to public
  using (auth.uid() = id);

create policy "Enable insert for users based on user_id" on public.profiles
  for insert to public
  with check ((select auth.uid()) = id);

grant all on all tables in schema public to anon;
grant all on all sequences in schema public to anon;

-- Back to the version without the "not deleted" check
create or replace function public.delete_order_permanently(p_order_id integer)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  delete from public.order_items where order_id = p_order_id;
  delete from public.orders where id = p_order_id;
end;
$$;
