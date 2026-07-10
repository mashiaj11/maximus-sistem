-- Maximus Hamburgueria - Supabase schema
-- Fase 1: schema preparado. Nao execute automaticamente; rode manualmente no Supabase quando for aplicar.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.units (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  phone text,
  address text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  is_open boolean not null default true,
  business_hours jsonb not null default '[]'::jsonb,
  theme text not null default 'light',
  kitchen_print_settings jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint units_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint units_theme_check check (theme in ('dark', 'light'))
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_phone_not_blank check (length(trim(phone)) > 0)
);

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  label text,
  street text not null,
  number text,
  complement text,
  neighborhood text,
  city text not null default 'Santarem',
  state text not null default 'PA',
  postal_code text,
  reference text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  delivery_zone_id uuid,
  delivery_zone_name text,
  delivery_fee_snapshot numeric(10, 2),
  is_primary boolean not null default false,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.delivery_zones (
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

alter table public.customer_addresses
  add constraint customer_addresses_delivery_zone_id_fkey
  foreign key (delivery_zone_id) references public.delivery_zones(id) on delete set null;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort_order integer not null default 0,
  availability_scope text not null default 'all',
  print_destination text not null default 'kitchen',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint categories_availability_scope_check check (
    availability_scope in ('all', 'dine_in_only', 'delivery_only', 'takeaway_only')
  ),
  constraint categories_print_destination_check check (print_destination in ('kitchen', 'cashier', 'bar', 'none'))
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  category_id uuid not null references public.categories(id),
  name text not null,
  slug text not null,
  description text,
  price numeric(10, 2) not null,
  image_url text,
  option_groups jsonb not null default '[]'::jsonb,
  available boolean not null default true,
  available_for_delivery boolean not null default true,
  available_for_pickup boolean not null default true,
  available_for_dine_in boolean not null default true,
  dine_in_only boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_unique_slug_per_unit unique (unit_id, slug),
  constraint products_price_non_negative check (price >= 0),
  constraint products_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create table public.product_unit_availability (
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

create table public.store_tables (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  table_number integer not null,
  public_url text not null,
  qr_code_data text not null,
  status text not null default 'livre',
  active boolean not null default true,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_tables_unique_number_per_unit unique (unit_id, table_number),
  constraint store_tables_number_positive check (table_number > 0),
  constraint store_tables_status_check check (status in ('livre', 'ocupada', 'pedido_ativo'))
);

create table public.delivery_drivers (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  name text not null,
  phone text,
  username text,
  access_pin text,
  password_hash text,
  status text not null default 'disponivel',
  active boolean not null default true,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_drivers_unique_phone_per_unit unique (unit_id, phone),
  constraint delivery_drivers_unique_username_per_unit unique (unit_id, username),
  constraint delivery_drivers_status_check check (status in ('disponivel', 'em_entrega', 'inativo'))
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id),
  unit_name text,
  unit_lat numeric(10, 7),
  unit_lng numeric(10, 7),
  customer_id uuid references public.customers(id),
  customer_address_id uuid references public.customer_addresses(id),
  table_id uuid references public.store_tables(id),
  delivery_driver_id uuid references public.delivery_drivers(id),
  delivery_driver_name text,
  order_number integer not null,
  order_type text not null,
  status text not null default 'received',
  payment_status text not null default 'pending',
  payment_method text,
  customer_name text,
  customer_phone text,
  recipient_name text,
  recipient_phone text,
  recipient_notes text,
  delivery_fee numeric(10, 2) not null default 0,
  delivery_payout_amount numeric(10, 2) not null default 0,
  delivery_range_id uuid references public.delivery_fee_rules(id) on delete set null,
  delivery_zone_id uuid references public.delivery_zones(id) on delete set null,
  delivery_zone_name text,
  customer_lat numeric(10, 7),
  customer_lng numeric(10, 7),
  customer_address_text text,
  delivery_lat numeric(10, 7),
  delivery_lng numeric(10, 7),
  delivery_location_source text,
  geocoding_status text,
  delivery_distance_km numeric(8, 2),
  delivery_estimated_time integer,
  delivery_calculation_method text,
  address_street text,
  address_number text,
  address_neighborhood text,
  address_complement text,
  address_reference text,
  driver_lat numeric(10, 7),
  driver_lng numeric(10, 7),
  driver_id uuid,
  driver_name text,
  delivery_fee_snapshot numeric(10, 2) not null default 0,
  minimum_order_value numeric(10, 2) not null default 0,
  driver_earned_value numeric(10, 2) not null default 0,
  payment_confirmed boolean not null default false,
  delivery_completed_by_driver boolean not null default false,
  delivery_status text,
  kitchen_print_status text not null default 'disabled',
  kitchen_printed_at timestamptz,
  out_for_delivery_at timestamptz,
  navigation_started_at timestamptz,
  delivered_at timestamptz,
  subtotal numeric(10, 2) not null default 0,
  total numeric(10, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_unique_number_per_unit unique (unit_id, order_number),
  constraint orders_type_check check (order_type in ('delivery', 'dine_in', 'takeaway')),
  constraint orders_status_check check (
    status in (
      'received',
      'accepted',
      'in_preparation',
      'ready',
      'out_for_delivery',
      'driver_on_way',
      'driver_nearby',
      'arrived',
      'ready_for_pickup',
      'delivered_to_table',
      'picked_up',
      'delivered',
      'cancelled'
    )
  ),
  constraint orders_payment_status_check check (
    payment_status in ('pending', 'customer_reported_paid', 'confirmed', 'rejected', 'paid_on_delivery')
  ),
  constraint orders_kitchen_print_status_check check (kitchen_print_status in ('pending', 'printed', 'error', 'disabled')),
  constraint orders_amounts_non_negative check (
    delivery_fee >= 0
    and delivery_payout_amount >= 0
    and delivery_fee_snapshot >= 0
    and minimum_order_value >= 0
    and driver_earned_value >= 0
    and subtotal >= 0
    and total >= 0
  ),
  constraint orders_table_required_for_dine_in check (order_type <> 'dine_in' or table_id is not null),
  constraint orders_address_required_for_delivery check (order_type <> 'delivery' or customer_address_id is not null)
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id),
  product_name text not null,
  quantity integer not null,
  unit_price numeric(10, 2) not null,
  total_price numeric(10, 2) not null,
  customizations jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_items_quantity_positive check (quantity > 0),
  constraint order_items_amounts_non_negative check (unit_price >= 0 and total_price >= 0)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  method text not null,
  status text not null default 'pending',
  amount numeric(10, 2) not null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_status_check check (
    status in ('pending', 'customer_reported_paid', 'confirmed', 'rejected', 'paid_on_delivery')
  ),
  constraint payments_amount_non_negative check (amount >= 0)
);

create table public.print_jobs (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  print_type text not null,
  destination text not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  printed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint print_jobs_destination_check check (destination in ('kitchen', 'cashier', 'bar', 'custom')),
  constraint print_jobs_status_check check (
    status in ('pending', 'processing', 'printed', 'failed', 'simulated', 'cancelled')
  ),
  constraint print_jobs_attempts_non_negative check (attempts >= 0)
);

create table public.delivery_fee_rules (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  max_distance_km numeric(6, 2) not null,
  estimated_minutes integer not null,
  delivery_fee numeric(10, 2) not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_fee_rules_unique_distance_per_unit unique (unit_id, max_distance_km),
  constraint delivery_fee_rules_values_valid check (max_distance_km > 0 and estimated_minutes > 0 and delivery_fee >= 0)
);

create table public.admin_settings (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  require_driver_completion boolean not null default false,
  whatsapp_enabled boolean not null default false,
  whatsapp_provider text not null default 'none',
  whatsapp_api_url text,
  whatsapp_api_key text,
  whatsapp_instance_id text,
  whatsapp_number text,
  whatsapp_messages jsonb not null default '{}'::jsonb,
  official_phone text,
  delivery_panel_enabled boolean not null default false,
  kitchen_print_enabled boolean not null default false,
  kitchen_print_settings jsonb not null default '{}'::jsonb,
  minimum_order_value numeric(10, 2) not null default 0,
  base_delivery_fee numeric(10, 2) not null default 0,
  delivery_fee_per_km numeric(10, 2) not null default 0,
  max_delivery_distance_km numeric(8, 2) not null default 0,
  free_delivery_from numeric(10, 2) not null default 0,
  admin_pin text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_settings_unique_unit unique (unit_id),
  constraint admin_settings_whatsapp_provider_check check (
    whatsapp_provider in ('none', 'evolution', 'waha', 'zapi')
  ),
  constraint admin_settings_delivery_values_non_negative check (
    minimum_order_value >= 0
    and base_delivery_fee >= 0
    and delivery_fee_per_km >= 0
    and max_delivery_distance_km >= 0
    and free_delivery_from >= 0
  )
);

create or replace function public.enforce_customer_address_limit()
returns trigger
language plpgsql
as $$
begin
  if (
    select count(*)
    from public.customer_addresses
    where customer_id = new.customer_id
      and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) >= 5 then
    raise exception 'Cada cliente pode ter no maximo 5 enderecos.';
  end if;

  return new;
end;
$$;

create trigger enforce_customer_address_limit
before insert or update on public.customer_addresses
for each row execute function public.enforce_customer_address_limit();

create unique index customer_addresses_one_primary_per_customer
  on public.customer_addresses(customer_id)
  where is_primary and is_active;

create trigger set_units_updated_at before update on public.units
for each row execute function public.set_updated_at();
create trigger set_customers_updated_at before update on public.customers
for each row execute function public.set_updated_at();
create trigger set_customer_addresses_updated_at before update on public.customer_addresses
for each row execute function public.set_updated_at();
create trigger set_categories_updated_at before update on public.categories
for each row execute function public.set_updated_at();
create trigger set_products_updated_at before update on public.products
for each row execute function public.set_updated_at();
create trigger set_product_unit_availability_updated_at before update on public.product_unit_availability
for each row execute function public.set_updated_at();
create trigger set_store_tables_updated_at before update on public.store_tables
for each row execute function public.set_updated_at();
create trigger set_delivery_drivers_updated_at before update on public.delivery_drivers
for each row execute function public.set_updated_at();
create trigger set_orders_updated_at before update on public.orders
for each row execute function public.set_updated_at();
create trigger set_order_items_updated_at before update on public.order_items
for each row execute function public.set_updated_at();
create trigger set_payments_updated_at before update on public.payments
for each row execute function public.set_updated_at();
create trigger set_print_jobs_updated_at before update on public.print_jobs
for each row execute function public.set_updated_at();
create trigger set_delivery_fee_rules_updated_at before update on public.delivery_fee_rules
for each row execute function public.set_updated_at();
create trigger set_delivery_zones_updated_at before update on public.delivery_zones
for each row execute function public.set_updated_at();
create trigger set_admin_settings_updated_at before update on public.admin_settings
for each row execute function public.set_updated_at();

create index idx_units_active on public.units(active);
create index idx_customers_phone on public.customers(phone);
create index idx_customer_addresses_customer_id on public.customer_addresses(customer_id);
create index idx_categories_scope_order on public.categories(availability_scope, sort_order);
create index idx_products_unit_category on public.products(unit_id, category_id);
create index idx_products_available on public.products(unit_id, available);
create index idx_product_unit_availability_unit on public.product_unit_availability(unit_id);
create index idx_product_unit_availability_product on public.product_unit_availability(product_id);
create index idx_store_tables_unit_id on public.store_tables(unit_id);
create index idx_delivery_drivers_unit_status on public.delivery_drivers(unit_id, status);
create index idx_delivery_fee_rules_unit_distance on public.delivery_fee_rules(unit_id, max_distance_km);
create index idx_delivery_zones_unit_active_order on public.delivery_zones(unit_id, active, sort_order, name);
create index idx_orders_unit_status on public.orders(unit_id, status);
create index idx_orders_unit_created_at on public.orders(unit_id, created_at desc);
create index idx_orders_customer_id on public.orders(customer_id);
create index idx_orders_table_id on public.orders(table_id);
create index idx_orders_delivery_driver_id on public.orders(delivery_driver_id);
create index idx_order_items_order_id on public.order_items(order_id);
create index idx_payments_order_id on public.payments(order_id);
create index idx_payments_status on public.payments(status);
create unique index print_jobs_order_type_destination_unique on public.print_jobs(order_id, print_type, destination);
create index idx_print_jobs_unit_status_created on public.print_jobs(unit_id, status, created_at);
create index idx_print_jobs_order_id on public.print_jobs(order_id);
create index idx_admin_settings_unit_id on public.admin_settings(unit_id);

alter table public.units enable row level security;
alter table public.customers enable row level security;
alter table public.customer_addresses enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_unit_availability enable row level security;
alter table public.store_tables enable row level security;
alter table public.delivery_drivers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.print_jobs enable row level security;
alter table public.delivery_fee_rules enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.admin_settings enable row level security;

-- Projeto ainda sem Auth/RBAC. Estas policies liberam a fase inicial via anon/authenticated.
-- Antes de producao, substitua por policies por perfil/unidade.
create policy "initial_public_access_units" on public.units for all to anon, authenticated using (true) with check (true);
create policy "initial_public_access_customers" on public.customers for all to anon, authenticated using (true) with check (true);
create policy "initial_public_access_customer_addresses" on public.customer_addresses for all to anon, authenticated using (true) with check (true);
create policy "initial_public_access_categories" on public.categories for all to anon, authenticated using (true) with check (true);
create policy "initial_public_access_products" on public.products for all to anon, authenticated using (true) with check (true);
create policy "initial_public_access_product_unit_availability" on public.product_unit_availability for all to anon, authenticated using (true) with check (true);
create policy "initial_public_access_store_tables" on public.store_tables for all to anon, authenticated using (true) with check (true);
create policy "initial_public_access_delivery_drivers" on public.delivery_drivers for all to anon, authenticated using (true) with check (true);
create policy "initial_public_access_orders" on public.orders for all to anon, authenticated using (true) with check (true);
create policy "initial_public_access_order_items" on public.order_items for all to anon, authenticated using (true) with check (true);
create policy "initial_public_access_payments" on public.payments for all to anon, authenticated using (true) with check (true);
create policy "initial_public_access_print_jobs" on public.print_jobs for all to anon, authenticated using (true) with check (true);
create policy "initial_public_access_delivery_fee_rules" on public.delivery_fee_rules for all to anon, authenticated using (true) with check (true);
create policy "initial_public_access_delivery_zones" on public.delivery_zones for all to anon, authenticated using (true) with check (true);
create policy "initial_public_access_admin_settings" on public.admin_settings for all to anon, authenticated using (true) with check (true);

create or replace function public.claim_next_print_job(p_unit_id uuid)
returns public.print_jobs
language plpgsql
as $$
declare
  v_job public.print_jobs;
begin
  update public.print_jobs
  set
    status = 'processing',
    attempts = attempts + 1,
    claimed_at = now(),
    error_message = null
  where id = (
    select id
    from public.print_jobs
    where unit_id = p_unit_id
      and status = 'pending'
    order by created_at asc
    for update skip locked
    limit 1
  )
  returning * into v_job;

  return v_job;
end;
$$;

grant execute on function public.claim_next_print_job(uuid) to anon, authenticated;

-- Data API grants for projects where new tables are not exposed automatically.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on
  public.units,
  public.customers,
  public.customer_addresses,
  public.categories,
  public.products,
  public.product_unit_availability,
  public.store_tables,
  public.delivery_drivers,
  public.orders,
  public.order_items,
  public.payments,
  public.print_jobs,
  public.delivery_fee_rules,
  public.admin_settings
to anon, authenticated;

alter table public.orders replica identity full;
alter table public.order_items replica identity full;
alter table public.payments replica identity full;
alter table public.delivery_drivers replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.orders;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.order_items;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.payments;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.delivery_drivers;
exception
  when duplicate_object then null;
end $$;
