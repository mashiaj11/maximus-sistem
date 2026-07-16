# Banco de Dados

O banco principal de negocio fica no Supabase. O Docker Compose local cria bancos separados para n8n e Evolution API.

## Migrations

As migrations versionaveis ficam em `supabase/migrations` e devem ser aplicadas em ordem pelo timestamp do nome do arquivo.

Inclua apenas schemas, funcoes, triggers, policies, RPCs e seeds sanitizados. Nao inclua dumps com clientes, telefones, pedidos ou dados pessoais.

## Tabelas criticas

Pedidos, itens, pagamentos, clientes, unidades, configuracoes administrativas, filas de impressao e tabelas de memoria/deduplicacao do bot.

## Backup e restauracao

Faca backup antes de qualquer alteracao estrutural. Teste restauracao em ambiente separado antes de mexer em producao.

## Acoes proibidas sem backup

Nao rode `DROP`, `TRUNCATE`, reset ou recriacao destrutiva em producao sem backup validado.
