-- Bootstrap the first Maximus super admin.
--
-- Manual usage:
-- 1. Create the first user through Supabase Auth.
-- 2. Replace EDIT_ME@example.invalid below with that user's email.
-- 3. Run this script manually in the Supabase SQL editor.
--
-- This script is idempotent:
-- - It creates or updates the user's profile as an active super_admin.
-- - It links the user to every active unit.
-- - It keeps exactly one active primary unit for that user when active units exist.
--
-- Do not commit real emails, passwords, UUIDs, or secrets into this file.

do $$
declare
  first_admin_email text := 'EDIT_ME@example.invalid';
  first_admin_user_id uuid;
  first_primary_unit_id uuid;
begin
  if first_admin_email = 'EDIT_ME@example.invalid' then
    raise exception 'Edit first_admin_email before running this bootstrap script.';
  end if;

  select users.id
    into first_admin_user_id
  from auth.users
  where lower(users.email) = lower(first_admin_email)
  limit 1;

  if first_admin_user_id is null then
    raise exception 'No auth.users record found for email: %', first_admin_email;
  end if;

  select units.id
    into first_primary_unit_id
  from public.units
  where units.active = true
  order by units.created_at, units.id
  limit 1;

  insert into public.user_profiles (
    id,
    full_name,
    role,
    active
  )
  values (
    first_admin_user_id,
    first_admin_email,
    'super_admin',
    true
  )
  on conflict (id) do update
  set
    role = 'super_admin',
    active = true,
    updated_at = now();

  update public.user_unit_access
  set
    is_primary = false,
    active = false,
    updated_at = now()
  where user_id = first_admin_user_id
    and (active = true or is_primary = true);

  if first_primary_unit_id is not null then
    insert into public.user_unit_access (
      user_id,
      unit_id,
      is_primary,
      active
    )
    select
      first_admin_user_id,
      units.id,
      units.id = first_primary_unit_id,
      true
    from public.units
    where units.active = true
    on conflict (user_id, unit_id) do update
    set
      is_primary = excluded.is_primary,
      active = true,
      updated_at = now();
  end if;
end;
$$;
