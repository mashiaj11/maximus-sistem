-- Auth foundation for Maximus.
-- This migration only adds user profile and unit access tables.

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_profiles_role_check check (
    role in (
      'super_admin',
      'owner',
      'unit_manager',
      'cashier',
      'kitchen',
      'bar',
      'delivery_manager',
      'viewer'
    )
  )
);

create table public.user_unit_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  is_primary boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_unit_access_user_unit_unique unique (user_id, unit_id)
);

create unique index user_unit_access_one_active_primary_per_user
  on public.user_unit_access (user_id)
  where active = true and is_primary = true;

create index user_unit_access_user_id_idx
  on public.user_unit_access (user_id);

create index user_unit_access_unit_id_idx
  on public.user_unit_access (unit_id);

create trigger set_user_profiles_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();

create trigger set_user_unit_access_updated_at
before update on public.user_unit_access
for each row execute function public.set_updated_at();

alter table public.user_profiles enable row level security;
alter table public.user_unit_access enable row level security;

revoke all on public.user_profiles from public;
revoke all on public.user_unit_access from public;

revoke all on public.user_profiles from anon;
revoke all on public.user_unit_access from anon;

revoke all on public.user_profiles from authenticated;
revoke all on public.user_unit_access from authenticated;

revoke insert, update, delete on public.user_profiles from authenticated;
revoke insert, update, delete on public.user_unit_access from authenticated;

grant select on public.user_profiles to authenticated;
grant select on public.user_unit_access to authenticated;

create policy "authenticated_read_own_user_profile"
on public.user_profiles
for select
to authenticated
using (id = auth.uid());

create policy "authenticated_read_own_user_unit_access"
on public.user_unit_access
for select
to authenticated
using (user_id = auth.uid());
