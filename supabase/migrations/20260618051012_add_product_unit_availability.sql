create table if not exists public.product_unit_availability (
  product_id uuid not null references public.products(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  is_available boolean not null default true,
  available_for_delivery boolean not null default true,
  available_for_pickup boolean not null default true,
  available_for_dine_in boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_unit_availability_product_unit_unique unique (product_id, unit_id)
);

create index if not exists idx_product_unit_availability_unit
  on public.product_unit_availability(unit_id);

create index if not exists idx_product_unit_availability_product
  on public.product_unit_availability(product_id);

drop trigger if exists set_product_unit_availability_updated_at
  on public.product_unit_availability;

create trigger set_product_unit_availability_updated_at
before update on public.product_unit_availability
for each row execute function public.set_updated_at();

alter table public.product_unit_availability enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'product_unit_availability'
      and policyname = 'initial_public_access_product_unit_availability'
  ) then
    create policy "initial_public_access_product_unit_availability"
    on public.product_unit_availability
    for all
    to anon, authenticated
    using (true)
    with check (true);
  end if;
end $$;

grant all on public.product_unit_availability to anon, authenticated;

with active_units as (
  select id
  from public.units
  where active = true
),
ranked_products as (
  select
    products.*,
    first_value(products.id) over (
      partition by
        products.category_id,
        lower(trim(products.name)),
        products.price,
        coalesce(products.description, ''),
        coalesce(products.image_url, ''),
        products.option_groups
      order by products.created_at asc, products.id asc
    ) as canonical_product_id
  from public.products
  where products.unit_id is not null
    and products.deleted_at is null
),
canonical_products as (
  select distinct on (canonical_product_id)
    canonical_product_id as product_id,
    category_id,
    name,
    price,
    description,
    image_url,
    option_groups,
    available,
    available_for_delivery,
    available_for_pickup,
    available_for_dine_in
  from ranked_products
  where id = canonical_product_id
  order by canonical_product_id
),
availability_by_unit as (
  select
    canonical_product_id as product_id,
    unit_id,
    bool_or(available) as is_available,
    bool_or(coalesce(available_for_delivery, true)) as available_for_delivery,
    bool_or(coalesce(available_for_pickup, true)) as available_for_pickup,
    bool_or(coalesce(available_for_dine_in, true)) as available_for_dine_in
  from ranked_products
  group by canonical_product_id, unit_id
)
insert into public.product_unit_availability (
  product_id,
  unit_id,
  is_available,
  available_for_delivery,
  available_for_pickup,
  available_for_dine_in
)
select
  canonical_products.product_id,
  active_units.id,
  coalesce(availability_by_unit.is_available, canonical_products.available, true),
  coalesce(
    availability_by_unit.available_for_delivery,
    canonical_products.available_for_delivery,
    true
  ),
  coalesce(
    availability_by_unit.available_for_pickup,
    canonical_products.available_for_pickup,
    true
  ),
  coalesce(
    availability_by_unit.available_for_dine_in,
    canonical_products.available_for_dine_in,
    true
  )
from canonical_products
cross join active_units
left join availability_by_unit
  on availability_by_unit.product_id = canonical_products.product_id
  and availability_by_unit.unit_id = active_units.id
on conflict (product_id, unit_id) do update
set
  is_available = excluded.is_available,
  available_for_delivery = excluded.available_for_delivery,
  available_for_pickup = excluded.available_for_pickup,
  available_for_dine_in = excluded.available_for_dine_in;
