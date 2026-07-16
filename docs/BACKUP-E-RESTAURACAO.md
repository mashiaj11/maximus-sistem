# Backup e Restauracao

## Backup

- Supabase: use backup nativo do painel ou `pg_dump` com credenciais seguras.
- n8n: exporte workflows e faca backup do volume `n8n_data`.
- Evolution API: preserve o volume `evolution_instances` e o banco `evolution-postgres`.

## Restauracao

Restaure primeiro o banco, depois volumes e por fim workflows/credenciais.

## Nunca fazer sem backup

- `docker compose down -v`
- `DROP DATABASE`
- `DROP SCHEMA`
- `TRUNCATE`
- reset de migrations em producao
- importacao de dump com dados reais em repositorio Git
