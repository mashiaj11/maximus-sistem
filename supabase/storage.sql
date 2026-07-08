-- Maximus Hamburgueria - Storage para imagens de produtos
-- Execute depois de supabase/schema.sql.
-- Fase inicial: bucket publico e escrita aberta para anon/authenticated.
-- Antes de producao, restrinja insert/update/delete ao admin autenticado.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'products',
  'products',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'products_public_read'
  ) then
    create policy "products_public_read"
    on storage.objects
    for select
    to anon, authenticated
    using (bucket_id = 'products');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'products_initial_insert'
  ) then
    create policy "products_initial_insert"
    on storage.objects
    for insert
    to anon, authenticated
    with check (bucket_id = 'products');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'products_initial_update'
  ) then
    create policy "products_initial_update"
    on storage.objects
    for update
    to anon, authenticated
    using (bucket_id = 'products')
    with check (bucket_id = 'products');
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'products_initial_delete'
  ) then
    create policy "products_initial_delete"
    on storage.objects
    for delete
    to anon, authenticated
    using (bucket_id = 'products');
  end if;
end $$;
