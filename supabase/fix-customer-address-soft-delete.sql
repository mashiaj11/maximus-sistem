-- Maximus Hamburgueria - soft delete para enderecos de cliente
-- Seguro para pedidos existentes: nao remove enderecos referenciados por orders.

alter table public.customer_addresses
  add column if not exists is_active boolean not null default true,
  add column if not exists deleted_at timestamptz;

drop index if exists public.customer_addresses_one_primary_per_customer;

create unique index if not exists customer_addresses_one_primary_per_customer
  on public.customer_addresses(customer_id)
  where is_primary and is_active;
