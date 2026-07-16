begin;

grant select, insert, update, delete on table public.customers to authenticated;
grant select, insert, update, delete on table public.customer_addresses to authenticated;

drop policy if exists customers_staff_read on public.customers;
drop policy if exists customers_staff_manage on public.customers;
create policy customers_staff_read
on public.customers
for select
to authenticated
using (public.has_any_role(array['super_admin','owner','unit_manager','cashier','delivery_manager','viewer']));
create policy customers_staff_manage
on public.customers
for all
to authenticated
using (public.has_any_role(array['super_admin','owner','unit_manager','cashier']))
with check (public.has_any_role(array['super_admin','owner','unit_manager','cashier']));

drop policy if exists customer_addresses_staff_read on public.customer_addresses;
drop policy if exists customer_addresses_staff_manage on public.customer_addresses;
create policy customer_addresses_staff_read
on public.customer_addresses
for select
to authenticated
using (public.has_any_role(array['super_admin','owner','unit_manager','cashier','delivery_manager','viewer']));
create policy customer_addresses_staff_manage
on public.customer_addresses
for all
to authenticated
using (public.has_any_role(array['super_admin','owner','unit_manager','cashier']))
with check (public.has_any_role(array['super_admin','owner','unit_manager','cashier']));

commit;
