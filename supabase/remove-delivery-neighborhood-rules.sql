-- Remove definitivamente a funcionalidade descontinuada de taxas por bairro.

drop trigger if exists set_delivery_neighborhood_rules_updated_at
  on public.delivery_neighborhood_rules;

drop policy if exists "initial_public_access_delivery_neighborhood_rules"
  on public.delivery_neighborhood_rules;

drop table if exists public.delivery_neighborhood_rules;
