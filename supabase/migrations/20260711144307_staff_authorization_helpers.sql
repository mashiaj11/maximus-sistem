create or replace function public.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_profiles p
    where p.id = auth.uid() and p.active = true
  );
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_profiles p
    where p.id = auth.uid() and p.active = true and p.role = 'super_admin'
  );
$$;

create or replace function public.current_staff_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.role from public.user_profiles p
  where p.id = auth.uid() and p.active = true
  limit 1;
$$;

create or replace function public.has_unit_access(p_unit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_super_admin() or exists (
    select 1
    from public.user_unit_access a
    join public.user_profiles p on p.id = a.user_id
    where a.user_id = auth.uid()
      and a.unit_id = p_unit_id
      and a.active = true
      and p.active = true
  );
$$;

create or replace function public.has_any_role(p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_staff_role() = any(p_roles);
$$;

revoke all on function public.is_active_staff() from public, anon;
revoke all on function public.is_super_admin() from public, anon;
revoke all on function public.current_staff_role() from public, anon;
revoke all on function public.has_unit_access(uuid) from public, anon;
revoke all on function public.has_any_role(text[]) from public, anon;

grant execute on function public.is_active_staff(), public.is_super_admin(), public.current_staff_role(), public.has_unit_access(uuid), public.has_any_role(text[]) to authenticated, service_role;
