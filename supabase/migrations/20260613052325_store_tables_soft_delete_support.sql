alter table public.store_tables
  add column if not exists is_active boolean not null default true,
  add column if not exists deleted_at timestamptz;

update public.store_tables
set is_active = coalesce(is_active, active, true)
where is_active is distinct from coalesce(active, true);

create index if not exists idx_store_tables_active_visible
  on public.store_tables(unit_id, table_number)
  where is_active = true and deleted_at is null;

drop policy if exists "initial_public_access_store_tables" on public.store_tables;
create policy "initial_public_access_store_tables"
  on public.store_tables
  for all
  to anon, authenticated
  using (true)
  with check (true);;
