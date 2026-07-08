alter table public.products
  add column if not exists available_for_delivery boolean not null default true,
  add column if not exists available_for_pickup boolean not null default true,
  add column if not exists available_for_dine_in boolean not null default true,
  add column if not exists dine_in_only boolean not null default false;

update public.products
set
  available_for_delivery = false,
  available_for_pickup = false,
  available_for_dine_in = true,
  dine_in_only = true
where category_id in (
  select id
  from public.categories
  where availability_scope = 'dine_in_only'
);;
