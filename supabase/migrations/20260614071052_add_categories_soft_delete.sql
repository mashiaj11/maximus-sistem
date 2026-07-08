alter table public.categories add column if not exists deleted_at timestamptz;
create index if not exists categories_active_not_deleted_idx on public.categories (active, sort_order) where deleted_at is null;;
