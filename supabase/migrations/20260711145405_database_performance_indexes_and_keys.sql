create index if not exists checkout_idempotency_order_id_idx on public.checkout_idempotency(order_id);
create index if not exists customer_addresses_delivery_zone_id_idx on public.customer_addresses(delivery_zone_id);
create index if not exists order_items_product_id_idx on public.order_items(product_id);
create index if not exists orders_customer_address_id_idx on public.orders(customer_address_id);
create index if not exists orders_delivery_range_id_idx on public.orders(delivery_range_id);
create index if not exists orders_delivery_zone_id_idx on public.orders(delivery_zone_id);
create index if not exists products_category_id_idx on public.products(category_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conrelid='public.product_unit_availability'::regclass and contype='p'
  ) then
    alter table public.product_unit_availability add constraint product_unit_availability_pkey primary key (product_id,unit_id);
  end if;
end $$;

drop policy if exists user_profiles_read on public.user_profiles;
create policy user_profiles_read on public.user_profiles for select to authenticated
using (id = (select auth.uid()) or public.is_super_admin());

drop policy if exists user_unit_access_read on public.user_unit_access;
create policy user_unit_access_read on public.user_unit_access for select to authenticated
using (user_id = (select auth.uid()) or public.is_super_admin());
