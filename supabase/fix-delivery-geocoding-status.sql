-- Adiciona status de geocodificacao do destino da entrega.
-- Nao altera pedidos existentes alem de permitir registrar a origem/confianca do destino.

alter table public.orders
  add column if not exists geocoding_status text;

