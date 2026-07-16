revoke all on public.admin_settings from authenticated;
grant select, insert, update, delete on public.admin_settings to authenticated;
create policy admin_settings_staff_read on public.admin_settings for select to authenticated using (public.has_unit_access(unit_id) and public.has_any_role(array['super_admin','owner','unit_manager']));
create policy admin_settings_staff_manage on public.admin_settings for all to authenticated using (public.has_unit_access(unit_id) and public.has_any_role(array['super_admin','owner','unit_manager'])) with check (public.has_unit_access(unit_id) and public.has_any_role(array['super_admin','owner','unit_manager']));
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.enforce_customer_address_limit() from public, anon, authenticated;
