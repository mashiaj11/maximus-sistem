revoke all on function public.reset_operational_data(text, text, text) from public, anon, authenticated;
grant execute on function public.reset_operational_data(text, text, text) to service_role;

drop policy if exists initial_public_access_admin_settings on public.admin_settings;
alter table public.admin_settings enable row level security;
alter table public.admin_settings force row level security;
revoke all on table public.admin_settings from anon;
revoke all on table public.admin_settings from authenticated;
