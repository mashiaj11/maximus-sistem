begin;

grant select, insert, update, delete on table public.orders to authenticated;

drop policy if exists orders_staff_read on public.orders;
drop policy if exists orders_staff_insert on public.orders;
drop policy if exists orders_staff_update on public.orders;
drop policy if exists orders_staff_delete on public.orders;

create policy orders_staff_read
on public.orders
for select
to authenticated
using (
  public.has_unit_access(unit_id)
  and public.has_any_role(array['super_admin','owner','unit_manager','cashier','kitchen','bar','delivery_manager','viewer'])
);

create policy orders_staff_insert
on public.orders
for insert
to authenticated
with check (
  public.has_unit_access(unit_id)
  and public.has_any_role(array['super_admin','owner','unit_manager','cashier'])
);

create policy orders_staff_update
on public.orders
for update
to authenticated
using (
  public.has_unit_access(unit_id)
  and public.has_any_role(array['super_admin','owner','unit_manager','cashier','kitchen','bar','delivery_manager'])
)
with check (
  public.has_unit_access(unit_id)
  and public.has_any_role(array['super_admin','owner','unit_manager','cashier','kitchen','bar','delivery_manager'])
);

create policy orders_staff_delete
on public.orders
for delete
to authenticated
using (
  public.has_unit_access(unit_id)
  and public.has_any_role(array['super_admin','owner','unit_manager'])
);

commit;
