-- RLS step 1: only signed-in, approved users can reach application data.
--
-- Replaces the "everyone, including anonymous callers" policies. Nothing
-- changes for an approved user; anonymous and unapproved callers lose access.
-- Run after atomic_write_functions.sql. Undo with supabase/rollbacks/rls_rollback.sql.

-- Helpers -------------------------------------------------------------------
-- Kept in a schema the API does not expose. SECURITY DEFINER so that policies
-- on profiles / admin_users can ask "is the caller approved / an admin"
-- without recursing into their own policies.

create schema if not exists private;

create or replace function private.is_approved()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.approved
  );
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users a
    join public.profiles p on p.id = a.id
    where a.id = (select auth.uid())
      and p.approved
  );
$$;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

revoke execute on function private.is_approved(), private.is_admin() from public, anon;
grant execute on function private.is_approved(), private.is_admin() to authenticated;

-- Business and lookup tables -----------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'clients', 'client_phones', 'orders', 'order_items', 'products',
    'prices_new', 'stocks', 'coming_wares', 'coming_wares_items'
  ] loop
    execute format('drop policy if exists "Enable access for all users" on public.%I', t);
    execute format('drop policy if exists "Allow acces to users" on public.%I', t);
    execute format('drop policy if exists "Approved users have full access" on public.%I', t);
    execute format(
      'create policy "Approved users have full access" on public.%I
         for all to authenticated
         using ((select private.is_approved()))
         with check ((select private.is_approved()))',
      t
    );
  end loop;

  -- Reference data: the app only reads these
  foreach t in array array['categories', 'units', 'sizes', 'client_type'] loop
    execute format('drop policy if exists "Enable access for all users" on public.%I', t);
    execute format('drop policy if exists "Approved users can read" on public.%I', t);
    execute format(
      'create policy "Approved users can read" on public.%I
         for select to authenticated
         using ((select private.is_approved()))',
      t
    );
  end loop;
end;
$$;

-- admin_users: membership decides who is an admin, so only admins change it --

drop policy if exists "Enable access for all users" on public.admin_users;
drop policy if exists "Users see own membership, admins see all" on public.admin_users;
drop policy if exists "Admins can add admins" on public.admin_users;
drop policy if exists "Admins can remove admins" on public.admin_users;

create policy "Users see own membership, admins see all" on public.admin_users
  for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));

create policy "Admins can add admins" on public.admin_users
  for insert to authenticated
  with check ((select private.is_admin()));

create policy "Admins can remove admins" on public.admin_users
  for delete to authenticated
  using ((select private.is_admin()));

-- profiles ------------------------------------------------------------------
-- Rows are created by the handle_new_user trigger on auth.users, so no insert
-- policy is needed.

drop policy if exists "Admin can delete user" on public.profiles;
drop policy if exists "Admin can view all profiles" on public.profiles;
drop policy if exists "Admins can update any profile" on public.profiles;
drop policy if exists "Allow only approved users" on public.profiles;
drop policy if exists "Allow user to read their own profile" on public.profiles;
drop policy if exists "Enable insert for users based on user_id" on public.profiles;
drop policy if exists "Users can read their own profile" on public.profiles;
drop policy if exists "Approved users can read approved profiles" on public.profiles;
drop policy if exists "Admins can read all profiles" on public.profiles;
drop policy if exists "Admins can update profiles" on public.profiles;
drop policy if exists "Admins can delete profiles" on public.profiles;

-- Needed before approval too: login, session check, wait-to-approve page
create policy "Users can read their own profile" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

-- Operator names shown on orders
create policy "Approved users can read approved profiles" on public.profiles
  for select to authenticated
  using (approved and (select private.is_approved()));

create policy "Admins can read all profiles" on public.profiles
  for select to authenticated
  using ((select private.is_admin()));

create policy "Admins can update profiles" on public.profiles
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "Admins can delete profiles" on public.profiles
  for delete to authenticated
  using ((select private.is_admin()));

-- Anonymous callers get nothing --------------------------------------------

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Callable functions: signed-in users only (trigger functions are not callable)
do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prokind = 'f'
      and p.prorettype <> 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
