-- Maximus - iniciar operacao com uma unica unidade ativa.
-- Seguro: nao apaga unidades, produtos, pedidos, mesas ou configuracoes.
-- Use quando quiser testar o fluxo de adicionar novas unidades pelo admin.

begin;

update public.units
set
  active = case when slug = 'maximus-01' then true else false end,
  updated_at = now();

commit;

select
  slug,
  name,
  active
from public.units
order by slug;
