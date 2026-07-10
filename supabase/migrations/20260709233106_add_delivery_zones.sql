create table if not exists public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  name text not null,
  fee numeric(10, 2) not null default 0,
  estimated_time_min integer,
  estimated_time_max integer,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_zones_fee_non_negative check (fee >= 0),
  constraint delivery_zones_time_positive check (
    (estimated_time_min is null or estimated_time_min > 0)
    and (estimated_time_max is null or estimated_time_max > 0)
    and (
      estimated_time_min is null
      or estimated_time_max is null
      or estimated_time_max >= estimated_time_min
    )
  ),
  constraint delivery_zones_unique_name_per_unit unique (unit_id, name)
);

create index if not exists idx_delivery_zones_unit_active_order
  on public.delivery_zones(unit_id, active, sort_order, name);

drop trigger if exists set_delivery_zones_updated_at on public.delivery_zones;
create trigger set_delivery_zones_updated_at
before update on public.delivery_zones
for each row execute function public.set_updated_at();

alter table public.delivery_zones enable row level security;

drop policy if exists "initial_public_access_delivery_zones" on public.delivery_zones;
create policy "initial_public_access_delivery_zones"
on public.delivery_zones
for all
to anon, authenticated
using (true)
with check (true);

alter table public.customer_addresses
  add column if not exists delivery_zone_id uuid references public.delivery_zones(id) on delete set null,
  add column if not exists delivery_zone_name text,
  add column if not exists delivery_fee_snapshot numeric(10, 2);

alter table public.orders
  add column if not exists delivery_zone_id uuid references public.delivery_zones(id) on delete set null,
  add column if not exists delivery_zone_name text;
