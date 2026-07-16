drop policy if exists initial_public_access_customers on public.customers;
drop policy if exists initial_public_access_customer_addresses on public.customer_addresses;
drop policy if exists initial_public_access_delivery_drivers on public.delivery_drivers;
drop policy if exists initial_public_access_orders on public.orders;
drop policy if exists initial_public_access_order_items on public.order_items;
drop policy if exists initial_public_access_payments on public.payments;
drop policy if exists initial_public_access_print_jobs on public.print_jobs;

revoke all on public.customers, public.customer_addresses, public.delivery_drivers, public.orders, public.order_items, public.payments, public.print_jobs from anon;
revoke all on public.customers, public.customer_addresses, public.delivery_drivers, public.orders, public.order_items, public.payments, public.print_jobs from authenticated;
grant select, insert, update, delete on public.customers, public.customer_addresses, public.delivery_drivers, public.orders, public.order_items, public.payments, public.print_jobs to authenticated;

create policy customers_staff_read on public.customers for select to authenticated using (public.is_super_admin() or exists (select 1 from public.orders o where o.customer_id = customers.id and public.has_unit_access(o.unit_id)));
create policy customers_staff_manage on public.customers for all to authenticated using (public.has_any_role(array['super_admin','owner','unit_manager','cashier'])) with check (public.has_any_role(array['super_admin','owner','unit_manager','cashier']));

create policy addresses_staff_read on public.customer_addresses for select to authenticated using (public.is_super_admin() or exists (select 1 from public.orders o where o.customer_address_id = customer_addresses.id and public.has_unit_access(o.unit_id)));
create policy addresses_staff_manage on public.customer_addresses for all to authenticated using (public.has_any_role(array['super_admin','owner','unit_manager','cashier'])) with check (public.has_any_role(array['super_admin','owner','unit_manager','cashier']));

create policy drivers_staff_read on public.delivery_drivers for select to authenticated using (public.has_unit_access(unit_id));
create policy drivers_staff_manage on public.delivery_drivers for all to authenticated using (public.has_unit_access(unit_id) and public.has_any_role(array['super_admin','owner','unit_manager','delivery_manager'])) with check (public.has_unit_access(unit_id) and public.has_any_role(array['super_admin','owner','unit_manager','delivery_manager']));

create policy orders_staff_read on public.orders for select to authenticated using (public.has_unit_access(unit_id) and public.is_active_staff());
create policy orders_staff_insert on public.orders for insert to authenticated with check (public.has_unit_access(unit_id) and public.has_any_role(array['super_admin','owner','unit_manager','cashier']));
create policy orders_staff_update on public.orders for update to authenticated using (public.has_unit_access(unit_id) and public.has_any_role(array['super_admin','owner','unit_manager','cashier','kitchen','bar','delivery_manager'])) with check (public.has_unit_access(unit_id) and public.has_any_role(array['super_admin','owner','unit_manager','cashier','kitchen','bar','delivery_manager']));
create policy orders_staff_delete on public.orders for delete to authenticated using (public.has_unit_access(unit_id) and public.has_any_role(array['super_admin','owner','unit_manager']));

create policy order_items_staff_read on public.order_items for select to authenticated using (exists (select 1 from public.orders o where o.id = order_items.order_id and public.has_unit_access(o.unit_id)));
create policy order_items_staff_manage on public.order_items for all to authenticated using (exists (select 1 from public.orders o where o.id = order_items.order_id and public.has_unit_access(o.unit_id) and public.has_any_role(array['super_admin','owner','unit_manager','cashier']))) with check (exists (select 1 from public.orders o where o.id = order_items.order_id and public.has_unit_access(o.unit_id) and public.has_any_role(array['super_admin','owner','unit_manager','cashier'])));

create policy payments_staff_read on public.payments for select to authenticated using (exists (select 1 from public.orders o where o.id = payments.order_id and public.has_unit_access(o.unit_id)));
create policy payments_staff_manage on public.payments for all to authenticated using (exists (select 1 from public.orders o where o.id = payments.order_id and public.has_unit_access(o.unit_id) and public.has_any_role(array['super_admin','owner','unit_manager','cashier']))) with check (exists (select 1 from public.orders o where o.id = payments.order_id and public.has_unit_access(o.unit_id) and public.has_any_role(array['super_admin','owner','unit_manager','cashier'])));

create policy print_jobs_staff_read on public.print_jobs for select to authenticated using (public.has_unit_access(unit_id));
create policy print_jobs_staff_manage on public.print_jobs for all to authenticated using (public.has_unit_access(unit_id) and public.has_any_role(array['super_admin','owner','unit_manager','cashier','kitchen','bar'])) with check (public.has_unit_access(unit_id) and public.has_any_role(array['super_admin','owner','unit_manager','cashier','kitchen','bar']));
