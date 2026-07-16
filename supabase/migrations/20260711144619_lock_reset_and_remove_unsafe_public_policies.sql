begin;

alter table if exists public.customers enable row level security;
alter table if exists public.customer_addresses enable row level security;
alter table if exists public.delivery_drivers enable row level security;
alter table if exists public.orders enable row level security;
alter table if exists public.order_items enable row level security;
alter table if exists public.payments enable row level security;
alter table if exists public.print_jobs enable row level security;
alter table if exists public.admin_settings enable row level security;

drop policy if exists initial_public_access_customers on public.customers;
drop policy if exists initial_public_access_customer_addresses on public.customer_addresses;
drop policy if exists initial_public_access_delivery_drivers on public.delivery_drivers;
drop policy if exists initial_public_access_orders on public.orders;
drop policy if exists initial_public_access_order_items on public.order_items;
drop policy if exists initial_public_access_payments on public.payments;
drop policy if exists initial_public_access_print_jobs on public.print_jobs;

revoke all on function public.reset_operational_data(text, text, text) from public;
revoke all on function public.reset_operational_data(text, text, text) from anon;
revoke all on function public.reset_operational_data(text, text, text) from authenticated;
grant execute on function public.reset_operational_data(text, text, text) to service_role;

commit;
