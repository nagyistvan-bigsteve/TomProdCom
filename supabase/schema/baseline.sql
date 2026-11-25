-- =============================================================================
-- Baseline: the database as it was BEFORE the first migration in
-- supabase/migrations/ (20261013132406_atomic_write_functions.sql).
--
-- The base tables were created by hand in the Supabase dashboard and were never
-- in a migration, so the repo alone could not rebuild the database. To build a
-- new, empty Supabase project:
--   1. run this file;
--   2. run every file in supabase/migrations/ in filename order.
-- The result is the production schema of 2026-11-25 (checked against it:
-- columns, types, defaults, constraints, indexes, triggers, policies, cron).
--
-- NOT a migration on purpose: production and staging already have all of this,
-- and their migration history stays untouched.
--
-- SAFETY: it runs in one transaction and refuses to start when public.orders
-- already exists, so it can never touch staging or production (it would bring
-- back the dropped coming_wares tables and put placeholder trigger functions
-- in place of the real stock booking ones).
--
-- Read from production 2026-11-25. Things later migrations add or change are
-- left out here on purpose (they would make those migrations fail or differ):
--   * stocks.category_id, its check and the (product_id, category_id) index
--     (20261123152149_graded_stock); stocks starts as one row per product;
--   * order_items quantity / price checks (20261124130100_order_items_checks);
--   * every function, trigger and policy a migration creates.
-- Table grants to anon / authenticated come from Supabase's default privileges
-- on the public schema; the migrations revoke what must not be granted.
-- =============================================================================

begin;

do $$
begin
  if to_regclass('public.orders') is not null then
    raise exception 'baseline.sql is only for an empty database: public.orders already exists. Nothing was changed.';
  end if;
end;
$$;

create schema if not exists private;

-- Lookup tables ---------------------------------------------------------------

create table if not exists public.units (
  id serial constraint "pk_Unit" primary key,
  name varchar(50)
);

create table if not exists public.sizes (
  id serial constraint "pk_Sizes" primary key,
  name varchar(50)
);

create table if not exists public.categories (
  id serial constraint "pk_Categories" primary key,
  name varchar(50)
);

create table if not exists public.client_type (
  id integer constraint "pk_CustomerType" primary key,
  name varchar(100) not null constraint "uc_CustomerType_Name" unique
);

insert into public.units (id, name) values
  (1, 'buc'), (2, 'm2'), (3, 'm3'), (4, 'bundle')
on conflict (id) do nothing;

insert into public.sizes (id, name) values
  (0, 'Normal'), (1, 'Extra'), (2, 'Extra2')
on conflict (id) do nothing;

insert into public.categories (id, name) values
  (1, 'A'), (2, 'AB'), (3, 'B'), (4, 'T')
on conflict (id) do nothing;

insert into public.client_type (id, name) values
  (1, 'PF'), (2, 'PJ')
on conflict (id) do nothing;

select setval(pg_get_serial_sequence('public.units', 'id'), greatest((select max(id) from public.units), 1));
select setval(pg_get_serial_sequence('public.sizes', 'id'), greatest((select max(id) from public.sizes), 1));
select setval(pg_get_serial_sequence('public.categories', 'id'), greatest((select max(id) from public.categories), 1));

-- Users -----------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid default auth.uid() constraint profiles_pkey primary key,
  email text not null default '' constraint profiles_email_key unique,
  role text not null default 'user',
  approved boolean not null default false,
  name text
);

create table if not exists public.admin_users (
  id uuid constraint admin_users_pkey primary key
    constraint admin_users_id_fkey references auth.users (id)
);

-- A profile for every new sign-up (role 'user', not approved)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, new.raw_user_meta_data->>'name');
  return new;
end;
$function$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Clients ---------------------------------------------------------------------

create table if not exists public.clients (
  id serial constraint "pk_Customer" primary key,
  type integer not null constraint "fk_Customer_Type" references public.client_type (id),
  name varchar(100) not null constraint clients_name_check check (length(name::text) > 0),
  address varchar(100),
  code varchar(100) not null constraint clients_code_key unique,
  other_details varchar(1000),
  delivery_address text,
  tva boolean default false
);

create index if not exists "idx_Customer_Name" on public.clients using btree (name);

create table if not exists public.client_phones (
  id bigint generated by default as identity constraint client_phones_pkey primary key,
  client_id integer constraint client_phones_client_id_fkey references public.clients (id),
  phone varchar,
  label text
);

-- Products, prices, stock -------------------------------------------------------

create table if not exists public.products (
  id serial constraint "pk_Product" primary key,
  name text constraint products_name_key unique,
  unit_id integer not null constraint "fk_Product_UnitID" references public.units (id),
  size_id integer constraint "fk_Product_SizeID" references public.sizes (id),
  thickness double precision,
  width numeric(10, 2),
  length numeric(10, 2),
  m2_util double precision,
  m2_brut double precision,
  piece_per_pack smallint
);

create table if not exists public.prices_new (
  id integer generated by default as identity constraint prices_new_pkey primary key,
  unit_id integer not null constraint prices_new_unit_id_fkey references public.units (id),
  category_id integer not null constraint prices_new_category_id_fkey references public.categories (id),
  size_id integer constraint prices_new_size_id_fkey references public.sizes (id),
  price numeric not null,
  product_id integer constraint prices_new_product_id_fkey references public.products (id)
);

-- One row per product until 20261123152149_graded_stock adds category_id and
-- replaces the unique product_id with (product_id, category_id)
create table if not exists public.stocks (
  id bigint generated by default as identity constraint stocks_pkey primary key,
  product_id integer not null constraint stocks_product_id_fkey references public.products (id)
    constraint stocks_product_id_key unique,
  stock numeric not null,
  booked_stock numeric default 0
);

-- Orders and offers -------------------------------------------------------------

create table if not exists public.orders (
  id serial constraint "pk_Order" primary key,
  client_id integer not null constraint orders_client_id_fkey references public.clients (id),
  date_order_placed timestamptz default timezone('UTC', now()),
  expected_delivery date,
  date_order_delivered date,
  total_amount numeric,
  operator_id uuid constraint orders_operator_id_fkey references public.profiles (id),
  total_amount_final numeric,
  comment text,
  voucher text,
  until_delivery_date boolean default false,
  for_first_hour boolean default false,
  total_quantity numeric default 0,
  paid_amount numeric default 0,
  just_offer boolean default false,
  delivery_address text,
  delivery_fee numeric default 0,
  sort_order numeric,
  deleted_at timestamptz
);

create table if not exists public.order_items (
  id serial constraint "pk_OrderItem" primary key,
  product_id integer not null constraint "fk_OrderItem_ProductID" references public.products (id),
  order_id integer not null constraint "fk_OrderItem_OrderID" references public.orders (id),
  quantity numeric not null,
  category_id integer constraint order_items_category_id_fkey
    references public.categories (id) on update cascade,
  price numeric,
  item_status boolean default false,
  packs_pieces text
);

-- Admin drag-and-drop order of the orders list (20261125130000_advisor_cleanup
-- pins its search_path)
create or replace function public.update_order_sort_orders(items jsonb)
returns void
language sql
as $function$
  update orders o
  set sort_order = i.sort_order
  from jsonb_to_recordset(items) as i(id int, sort_order int)
  where o.id = i.id;
$function$;

-- The stock booking triggers on order_items predate the migrations; their
-- functions are (re)defined by 20261123152149_graded_stock. Placeholders here so
-- the triggers can be created; the migration replaces them with the real ones.
create or replace function public.trg_order_item_book_stock()
returns trigger language plpgsql as $$ begin return null; end; $$;
create or replace function public.trg_order_item_delete_unbook()
returns trigger language plpgsql as $$ begin return null; end; $$;
create or replace function public.trg_order_item_status_change()
returns trigger language plpgsql as $$ begin return null; end; $$;

create or replace trigger order_items_after_insert_book_stock
  after insert on public.order_items
  for each row execute function public.trg_order_item_book_stock();
create or replace trigger order_items_after_delete_unbook
  after delete on public.order_items
  for each row execute function public.trg_order_item_delete_unbook();
create or replace trigger order_items_after_status_update
  after update on public.order_items
  for each row execute function public.trg_order_item_status_change();

-- Truck intake before shipments (removed) -------------------------------------
-- Dropped by 20261123152149_graded_stock, but the October migrations still
-- create functions and policies on them, so they must exist for the replay.
-- Columns reconstructed from those functions (place_coming_wares etc.).

create table if not exists public.coming_wares (
  id bigint generated by default as identity primary key,
  expected_delivery date,
  name text,
  total_quantity numeric,
  all_for_order boolean default false,
  comment text,
  verified boolean default false
);

create table if not exists public.coming_wares_items (
  id bigint generated by default as identity primary key,
  order_id bigint references public.coming_wares (id),
  product_id integer references public.products (id),
  category integer,
  quantity numeric,
  for_order boolean default false,
  comment text
);

-- Row level security: on for every table; the policies come from the migrations

alter table public.units enable row level security;
alter table public.sizes enable row level security;
alter table public.categories enable row level security;
alter table public.client_type enable row level security;
alter table public.profiles enable row level security;
alter table public.admin_users enable row level security;
alter table public.clients enable row level security;
alter table public.client_phones enable row level security;
alter table public.products enable row level security;
alter table public.prices_new enable row level security;
alter table public.stocks enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.coming_wares enable row level security;
alter table public.coming_wares_items enable row level security;

commit;
