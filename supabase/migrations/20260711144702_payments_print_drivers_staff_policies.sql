begin;

grant select, insert, update, delete on table public.payments to authenticated;
grant select, insert, update, delete on table public.print_jobs to authenticated;
grant select, insert, update, delete on table public.delivery_drivers to authenticated;

drop policy if exists payments_staff_read on public.payments;
drop policy if exists payments_staff_manage on public.payments;
create policy payments_staff_read
on public.payments
for select
to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = payments.order_id
      and public.has_unit_access(o.unit_id)
      and public.has_any_role(array['super_admin','owner','unit_manager','cashier','delivery_manager','viewer'])
  )
);
create policy payments_staff_manage
on public.payments
for all
to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = payments.order_id
      and public.has_unit_access(o.unit_id)
      and public.has_any_role(array['super_admin','owner','unit_manager','cashier'])
  )
)
with check (
  exists (
    select 1 from public.orders o
    where o.id = payments.order_id
      and public.has_unit_access(o.unit_id)
      and public.has_any_role(array['super_admin','owner','unit_manager','cashier'])
  )
);

drop policy if exists print_jobs_staff_read on public.print_jobs;
drop policy if exists print_jobs_staff_manage on public.print_jobs;
create policy print_jobs_staff_read
on public.print_jobs
for select
to authenticated
using (
  public.has_unit_access(unit_id)
  and public.has_any_role(array['super_admin','owner','unit_manager','cashier','kitchen','bar'])
);
create policy print_jobs_staff_manage
on public.print_jobs
for all
to authenticated
using (
  public.has_unit_access(unit_id)
  and public.has_any_role(array['super_admin','owner','unit_manager','cashier','kitchen','bar'])
)
with check (
  public.has_unit_access(unit_id)
  and public.has_any_role(array['super_admin','owner','unit_manager','cashier','kitchen','bar'])
);

drop policy if exists delivery_drivers_staff_read on public.delivery_drivers;
drop policy if exists delivery_drivers_staff_manage on public.delivery_drivers;
create policy delivery_drivers_staff_read
on public.delivery_drivers
for select
to authenticated
using (
  public.has_unit_access(unit_id)
  and public.has_any_role(array['super_admin','owner','unit_manager','cashier','delivery_manager','viewer'])
);
create policy delivery_drivers_staff_manage
on public.delivery_drivers
for all
to authenticated
using (
  public.has_unit_access(unit_id)
  and public.has_any_role(array['super_admin','owner','unit_manager','delivery_manager'])
)
with check (
  public.has_unit_access(unit_id)
  and public.has_any_role(array['super_admin','owner','unit_manager','delivery_manager'])
);

commit;
