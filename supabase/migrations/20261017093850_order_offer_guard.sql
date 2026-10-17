-- Only admins may turn a real order back into an offer.
--
-- rls_admin_only_writes.sql lets any approved user hard-delete an offer, but
-- only admins hard-delete real orders. Without this guard a normal user could
-- set just_offer = true on an order through the API and then delete it for
-- good. Offer -> order (true -> false) stays allowed for everyone.
--
-- Run after rls_admin_only_writes.sql (uses private.is_admin()).

create or replace function private.prevent_order_to_offer()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if coalesce(old.just_offer, false) = false
     and new.just_offer = true
     and not (select private.is_admin()) then
    raise exception 'Only admins can turn an order into an offer'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace trigger orders_prevent_order_to_offer
  before update of just_offer on public.orders
  for each row
  execute function private.prevent_order_to_offer();
