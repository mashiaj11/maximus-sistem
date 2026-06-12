-- Correção para taxa de entrega por bairro/região.
-- Cria apenas a estrutura necessária. Não apaga pedidos, produtos ou regras existentes.

create table if not exists public.delivery_neighborhood_rules (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  neighborhood text not null,
  estimated_minutes integer not null,
  delivery_fee numeric(10, 2) not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_neighborhood_rules_unique_per_unit unique (unit_id, neighborhood),
  constraint delivery_neighborhood_rules_values_valid check (
    length(trim(neighborhood)) > 0
    and estimated_minutes > 0
    and delivery_fee >= 0
  )
);

create index if not exists idx_delivery_neighborhood_rules_unit_neighborhood
  on public.delivery_neighborhood_rules(unit_id, neighborhood);

alter table public.delivery_neighborhood_rules enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'delivery_neighborhood_rules'
      and policyname = 'initial_public_access_delivery_neighborhood_rules'
  ) then
    create policy "initial_public_access_delivery_neighborhood_rules"
      on public.delivery_neighborhood_rules
      for all
      to anon, authenticated
      using (true)
      with check (true);
  end if;
end $$;

drop trigger if exists set_delivery_neighborhood_rules_updated_at
  on public.delivery_neighborhood_rules;

create trigger set_delivery_neighborhood_rules_updated_at
before update on public.delivery_neighborhood_rules
for each row execute function public.set_updated_at();

grant select, insert, update, delete
on public.delivery_neighborhood_rules
to anon, authenticated;

