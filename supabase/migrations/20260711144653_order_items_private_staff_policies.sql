begin;

grant select, insert, update, delete on table public.order_items to authenticated;

drop policy if exists order_items_staff_read on public.order_items;
drop policy if exists order_items_staff_insert on public.order_items;
drop policy if exists order_items_staff_update on public.order_items;
drop policy if exists order_items_staff_delete on public.order_items;

create policy order_items_staff_read
on public.order_items
for select
to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and public.has_unit_access(o.unit_id)
      and public.has_any_role(array['super_admin','owner','unit_manager','cashier','kitchen','bar','delivery_manager','viewer'])
  )
);

create policy order_items_staff_insert
on public.order_items
for insert
to authenticated
with check (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and public.has_unit_access(o.unit_id)
      and public.has_any_role(array['super_admin','owner','unit_manager','cashier'])
  )
);

create policy order_items_staff_update
on public.order_items
for update
to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and public.has_unit_access(o.unit_id)
      and public.has_any_role(array['super_admin','owner','unit_manager','cashier'])
  )
)
with check (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and public.has_unit_access(o.unit_id)
      and public.has_any_role(array['super_admin','owner','unit_manager','cashier'])
  )
);

create policy order_items_staff_delete
on public.order_items
for delete
to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_items.order_id
      and public.has_unit_access(o.unit_id)
      and public.has_any_role(array['super_admin','owner','unit_manager'])
  )
);

commit;
