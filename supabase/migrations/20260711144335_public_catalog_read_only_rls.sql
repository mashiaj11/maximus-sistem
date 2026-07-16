drop policy if exists initial_public_access_units on public.units;
drop policy if exists initial_public_access_categories on public.categories;
drop policy if exists initial_public_access_products on public.products;
drop policy if exists initial_public_access_product_unit_availability on public.product_unit_availability;
drop policy if exists initial_public_access_delivery_fee_rules on public.delivery_fee_rules;
drop policy if exists initial_public_access_delivery_zones on public.delivery_zones;
drop policy if exists initial_public_access_store_tables on public.store_tables;

alter table public.units enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_unit_availability enable row level security;
alter table public.delivery_fee_rules enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.store_tables enable row level security;

revoke all on public.units, public.categories, public.products, public.product_unit_availability, public.delivery_fee_rules, public.delivery_zones, public.store_tables from anon;
grant select on public.units, public.categories, public.products, public.product_unit_availability, public.delivery_fee_rules, public.delivery_zones, public.store_tables to anon;

create policy units_public_read on public.units for select to anon using (active = true);
create policy categories_public_read on public.categories for select to anon using (active = true and deleted_at is null);
create policy products_public_read on public.products for select to anon using (available = true and deleted_at is null and exists (select 1 from public.units u where u.id = products.unit_id and u.active = true));
create policy product_availability_public_read on public.product_unit_availability for select to anon using (is_available = true and exists (select 1 from public.units u where u.id = product_unit_availability.unit_id and u.active = true));
create policy delivery_fee_rules_public_read on public.delivery_fee_rules for select to anon using (active = true and exists (select 1 from public.units u where u.id = delivery_fee_rules.unit_id and u.active = true));
create policy delivery_zones_public_read on public.delivery_zones for select to anon using (active = true and exists (select 1 from public.units u where u.id = delivery_zones.unit_id and u.active = true));
create policy store_tables_public_read on public.store_tables for select to anon using (active = true and is_active = true and deleted_at is null and exists (select 1 from public.units u where u.id = store_tables.unit_id and u.active = true));
