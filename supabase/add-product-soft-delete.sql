-- Maximus Hamburgueria - soft delete para produtos
-- Adiciona coluna deleted_at na tabela products para implementar soft delete real.

alter table public.products
  add column if not exists deleted_at timestamptz;
