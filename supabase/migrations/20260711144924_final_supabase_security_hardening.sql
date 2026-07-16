begin;

-- Eliminate the destructive production reset surface entirely.
revoke all on function public.reset_operational_data(text,text,text) from public, anon, authenticated, service_role;
drop function if exists public.reset_operational_data(text,text,text);

-- Retire exposed PIN material now that destructive PIN-based reset is removed.
update public.admin_settings
set admin_pin = null,
    settings = coalesce(settings, '{}'::jsonb) #- '{unit_patch,accessPin}',
    updated_at = now()
where admin_pin is not null
   or coalesce(settings, '{}'::jsonb) #> '{unit_patch,accessPin}' is not null;

-- Private checkout support tables are intentionally server-only.
revoke all on table public.checkout_idempotency from public, anon, authenticated;
revoke all on table public.checkout_rate_limits from public, anon, authenticated;
grant all on table public.checkout_idempotency to service_role;
grant all on table public.checkout_rate_limits to service_role;

-- The first checkout RPC version accepted arbitrary customization payloads without
-- server-side option-price validation. Keep it unavailable until replaced.
revoke all on function public.create_order_secure(jsonb) from public, anon, authenticated;
grant execute on function public.create_order_secure(jsonb) to service_role;

-- Fix mutable search_path warnings on trigger/worker functions.
alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.enforce_customer_address_limit() set search_path = public, pg_temp;
alter function public.claim_next_print_job(uuid) set search_path = public, pg_temp;

-- Public storage buckets are directly readable by URL and do not need broad
-- object-listing policies. Remove duplicate broad listing policies if present.
drop policy if exists "Public read products bucket" on storage.objects;
drop policy if exists products_public_read on storage.objects;

commit;
