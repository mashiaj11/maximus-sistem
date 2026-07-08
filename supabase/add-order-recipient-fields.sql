-- Adiciona dados de destinatário sem alterar comprador/customer.

alter table public.orders
  add column if not exists recipient_name text,
  add column if not exists recipient_phone text,
  add column if not exists recipient_notes text;
