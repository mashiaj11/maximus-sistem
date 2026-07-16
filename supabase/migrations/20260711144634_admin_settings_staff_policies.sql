begin;

grant select, insert, update on table public.admin_settings to authenticated;

drop policy if exists admin_settings_authenticated_read on public.admin_settings;
drop policy if exists admin_settings_authenticated_manage on public.admin_settings;

create policy admin_settings_authenticated_read
on public.admin_settings
for select
to authenticated
using (
  public.has_unit_access(unit_id)
  and public.has_any_role(array['super_admin','owner','unit_manager','cashier'])
);

create policy admin_settings_authenticated_manage
on public.admin_settings
for all
to authenticated
using (
  public.has_unit_access(unit_id)
  and public.has_any_role(array['super_admin','owner','unit_manager'])
)
with check (
  public.has_unit_access(unit_id)
  and public.has_any_role(array['super_admin','owner','unit_manager'])
);

commit;
