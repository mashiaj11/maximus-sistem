begin;

revoke all on table public.customers from anon;
revoke all on table public.customer_addresses from anon;
revoke all on table public.delivery_drivers from anon;
revoke all on table public.orders from anon;
revoke all on table public.order_items from anon;
revoke all on table public.payments from anon;
revoke all on table public.print_jobs from anon;
revoke all on table public.admin_settings from anon;
revoke all on table public.user_profiles from anon;
revoke all on table public.user_unit_access from anon;

revoke all on function public.claim_next_print_job(uuid) from public;
revoke all on function public.claim_next_print_job(uuid) from anon;
grant execute on function public.claim_next_print_job(uuid) to authenticated;
grant execute on function public.claim_next_print_job(uuid) to service_role;

commit;
