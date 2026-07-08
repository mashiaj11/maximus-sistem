# Aplicacao Supabase - Maximus

## Ordem exata no Supabase

1. Abra o projeto Supabase correto.
2. Va em SQL Editor.
3. Execute `supabase/schema.sql`.
4. Execute `supabase/storage.sql`.
5. Execute `supabase/seed.sql`.
6. Configure `.env` nos dois apps.
7. Rode os testes ponta a ponta.

## Comandos seguros

- `supabase/seed.sql` e idempotente. Pode executar novamente para atualizar os dados base.
- `supabase/storage.sql` e idempotente para o bucket `products` e suas policies.
- Os blocos de Realtime em `schema.sql` ignoram publicacoes ja existentes.

## Pontos de atencao

- `schema.sql` foi feito para projeto limpo ou banco ainda sem estas tabelas.
- `schema.sql` cria tabelas, constraints, triggers, indexes, RLS, grants e policies iniciais.
- Se as tabelas ja existirem, `create table public...` pode falhar. Nesse caso, aplique manualmente somente os `alter table add column` necessarios ou gere uma migration incremental.
- Nao ha `drop table`, `truncate`, `delete` ou comando que apague pedidos/clientes.
- As policies iniciais estao abertas para teste com `anon` e `authenticated`. Antes de producao, restrinja admin/entregador com Auth/RBAC.

## Realtime

As tabelas que precisam estar no Supabase Realtime:

- `orders`
- `order_items`
- `payments`
- `delivery_drivers`

O `schema.sql` executa:

- `alter table ... replica identity full`
- `alter publication supabase_realtime add table ...`

Tambem confira no painel:

1. Database.
2. Replication.
3. Publication `supabase_realtime`.
4. Confirmar as quatro tabelas acima.

## Storage

Bucket:

- Nome: `products`
- Publico: sim, nesta fase
- Uso: imagens de produtos do cardapio

Como funciona no app:

- Admin envia imagem em `/admin/cardapio` para o bucket `products`.
- Admin salva a URL publica em `products.image_url`.
- Publico le `products.image_url` e exibe no cardapio.

Policies iniciais em `storage.sql`:

- leitura publica para `anon` e `authenticated`;
- insert/update/delete liberado para `anon` e `authenticated` somente no bucket `products`.

Risco:

- Escrita anonima no Storage serve apenas para teste inicial.
- Antes de producao, trocar insert/update/delete para admin autenticado.

## Variaveis de ambiente

Criar nos dois apps:

`maximus-public/.env`

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_ANON_KEY
```

`maximus-admin/.env`

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_ANON_KEY
```

Nao usar service role no frontend.

## Teste ponta a ponta

1. Publico carrega `/menu` com produtos reais do Supabase.
2. Publico seleciona Maximus Santíssimo e finaliza um pedido delivery.
3. Pedido aparece no admin sem refresh.
4. Admin muda status do pedido.
5. Publico em `/acompanhar/:id` atualiza o status sem refresh.
6. Admin salva configuracoes da Maximus Santíssimo, atualiza a pagina e confirma persistencia.
7. Repetir configuracoes na Maximus 02 e confirmar que nao misturou dados.
8. Criar pedido na Maximus 02 e confirmar que aparece filtrado na unidade correta.
9. Atribuir entregador.
10. Painel do entregador recebe pedido atribuido.
11. Entregador envia GPS, finaliza entrega e confirma pagamento.
12. Dashboard soma valores reais do pedido e da entrega.

## Antes de producao

- Implementar Auth real para admin.
- Fechar RLS por perfil/unidade.
- Fechar Storage para escrita somente do admin autenticado.
- Revisar Data API grants se o projeto exigir grants explicitos.
- Validar backups antes de aplicar em banco com dados reais.
