begin;

-- Keep a single canonical public checkout RPC.
revoke all on function public.create_order_secure_v2(jsonb) from public, anon, authenticated, service_role;
drop function if exists public.create_order_secure_v2(jsonb);

-- Canonical checkout RPC is intentionally public because checkout is public,
-- but all writes remain server-calculated and atomic inside the function.
revoke all on function public.create_order_secure(jsonb) from public;
grant execute on function public.create_order_secure(jsonb) to anon, authenticated, service_role;

-- Ensure the destructive reset cannot reappear through stale grants.
drop function if exists public.reset_operational_data(text,text,text);

-- Keep legacy PIN storage empty while retaining the nullable column for frontend compatibility.
update public.admin_settings
set admin_pin = null,
    settings = coalesce(settings,'{}'::jsonb) #- '{unit_patch,accessPin}',
    updated_at = now()
where admin_pin is not null
   or coalesce(settings,'{}'::jsonb) #> '{unit_patch,accessPin}' is not null;

-- Explicitly deny anonymous direct access to every operational/private table.
revoke all on table public.admin_settings, public.customers, public.customer_addresses,
  public.orders, public.order_items, public.payments, public.delivery_drivers,
  public.print_jobs, public.user_profiles, public.user_unit_access,
  public.checkout_idempotency, public.checkout_rate_limits
from anon;

-- Public catalog remains read-only.
revoke insert, update, delete, truncate, references, trigger on table
  public.units, public.categories, public.products, public.product_unit_availability,
  public.store_tables, public.delivery_fee_rules, public.delivery_zones
from anon;
grant select on table
  public.units, public.categories, public.products, public.product_unit_availability,
  public.store_tables, public.delivery_fee_rules, public.delivery_zones
  to anon;

commit;
