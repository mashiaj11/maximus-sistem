-- Maximus Hamburgueria - confiabilidade operacional admin
-- Adiciona PIN admin por unidade, login simples de entregador e soft delete.

alter table public.admin_settings
  add column if not exists admin_pin text;

alter table public.delivery_drivers
  add column if not exists username text,
  add column if not exists access_pin text,
  add column if not exists password_hash text,
  add column if not exists is_active boolean not null default true,
  add column if not exists deleted_at timestamptz;

update public.delivery_drivers
set is_active = active
where is_active is distinct from active;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'delivery_drivers_unique_username_per_unit'
  ) then
    alter table public.delivery_drivers
      add constraint delivery_drivers_unique_username_per_unit unique (unit_id, username);
  end if;
end $$;

create index if not exists idx_delivery_drivers_active
  on public.delivery_drivers(unit_id, is_active, status);
