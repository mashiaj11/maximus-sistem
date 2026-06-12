-- Maximus Hamburgueria - registro de inicio de navegacao do entregador

alter table public.orders
  add column if not exists navigation_started_at timestamptz;
