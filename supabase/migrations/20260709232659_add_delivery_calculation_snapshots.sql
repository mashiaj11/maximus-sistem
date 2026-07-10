alter table public.orders
  add column if not exists delivery_estimated_time integer,
  add column if not exists delivery_calculation_method text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_delivery_estimated_time_positive'
  ) then
    alter table public.orders
      add constraint orders_delivery_estimated_time_positive
      check (delivery_estimated_time is null or delivery_estimated_time > 0) not valid;
  end if;
end
$$;
