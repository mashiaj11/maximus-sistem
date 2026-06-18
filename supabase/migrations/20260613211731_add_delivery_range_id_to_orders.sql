alter table public.orders
  add column if not exists delivery_range_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_delivery_range_id_fkey'
  ) then
    alter table public.orders
      add constraint orders_delivery_range_id_fkey
      foreign key (delivery_range_id)
      references public.delivery_fee_rules(id)
      on delete set null;
  end if;
end $$;;
