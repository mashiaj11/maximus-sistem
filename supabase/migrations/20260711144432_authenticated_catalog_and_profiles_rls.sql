drop policy if exists authenticated_read_own_user_profile on public.user_profiles;
drop policy if exists authenticated_read_own_user_unit_access on public.user_unit_access;

revoke all on public.user_profiles, public.user_unit_access from authenticated;
grant select, insert, update, delete on public.user_profiles, public.user_unit_access to authenticated;

create policy user_profiles_read on public.user_profiles for select to authenticated using (id = auth.uid() or public.is_super_admin());
create policy user_profiles_manage on public.user_profiles for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy user_unit_access_read on public.user_unit_access for select to authenticated using (user_id = auth.uid() or public.is_super_admin());
create policy user_unit_access_manage on public.user_unit_access for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

revoke all on public.units, public.categories, public.products, public.product_unit_availability, public.delivery_fee_rules, public.delivery_zones, public.store_tables from authenticated;
grant select, insert, update, delete on public.units, public.categories, public.products, public.product_unit_availability, public.delivery_fee_rules, public.delivery_zones, public.store_tables to authenticated;

create policy units_authenticated_read on public.units for select to authenticated using (active = true or public.has_unit_access(id));
create policy units_authenticated_manage on public.units for all to authenticated using (public.has_unit_access(id) and public.has_any_role(array['super_admin','owner','unit_manager'])) with check (public.has_unit_access(id) and public.has_any_role(array['super_admin','owner','unit_manager']));
create policy categories_authenticated_read on public.categories for select to authenticated using (active = true and deleted_at is null or public.is_active_staff());
create policy categories_authenticated_manage on public.categories for all to authenticated using (public.has_any_role(array['super_admin','owner','unit_manager'])) with check (public.has_any_role(array['super_admin','owner','unit_manager']));
create policy products_authenticated_read on public.products for select to authenticated using ((available = true and deleted_at is null) or public.has_unit_access(unit_id));
create policy products_authenticated_manage on public.products for all to authenticated using (public.has_unit_access(unit_id) and public.has_any_role(array['super_admin','owner','unit_manager'])) with check (public.has_unit_access(unit_id) and public.has_any_role(array['super_admin','owner','unit_manager']));
create policy product_availability_authenticated_read on public.product_unit_availability for select to authenticated using (is_available = true or public.has_unit_access(unit_id));
create policy product_availability_authenticated_manage on public.product_unit_availability for all to authenticated using (public.has_unit_access(unit_id) and public.has_any_role(array['super_admin','owner','unit_manager'])) with check (public.has_unit_access(unit_id) and public.has_any_role(array['super_admin','owner','unit_manager']));
create policy delivery_fee_rules_authenticated_read on public.delivery_fee_rules for select to authenticated using (active = true or public.has_unit_access(unit_id));
create policy delivery_fee_rules_authenticated_manage on public.delivery_fee_rules for all to authenticated using (public.has_unit_access(unit_id) and public.has_any_role(array['super_admin','owner','unit_manager'])) with check (public.has_unit_access(unit_id) and public.has_any_role(array['super_admin','owner','unit_manager']));
create policy delivery_zones_authenticated_read on public.delivery_zones for select to authenticated using (active = true or public.has_unit_access(unit_id));
create policy delivery_zones_authenticated_manage on public.delivery_zones for all to authenticated using (public.has_unit_access(unit_id) and public.has_any_role(array['super_admin','owner','unit_manager'])) with check (public.has_unit_access(unit_id) and public.has_any_role(array['super_admin','owner','unit_manager']));
create policy store_tables_authenticated_read on public.store_tables for select to authenticated using ((active = true and is_active = true and deleted_at is null) or public.has_unit_access(unit_id));
create policy store_tables_authenticated_manage on public.store_tables for all to authenticated using (public.has_unit_access(unit_id) and public.has_any_role(array['super_admin','owner','unit_manager','cashier'])) with check (public.has_unit_access(unit_id) and public.has_any_role(array['super_admin','owner','unit_manager','cashier']));
