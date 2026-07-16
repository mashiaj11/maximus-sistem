# Maximus no MacBook

Portas locais:

- Admin: `http://127.0.0.1:8080`
- Public: `http://127.0.0.1:8081`
- n8n: `http://127.0.0.1:5678`
- Evolution API: `http://127.0.0.1:8082`

Comandos:

```bash
cd maximus-mac-ready
chmod +x scripts/*.sh n8n/import-workflows.sh
./scripts/mac-install.sh
./scripts/mac-start.sh
```

Status, logs e parada:

```bash
./scripts/mac-status.sh
./scripts/mac-logs.sh
./scripts/mac-stop.sh
```

Variaveis que precisam ser levadas para o Mac:

- `maximus-admin/.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `maximus-public/.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_MAPS_API_KEY` se usar mapas
- `.env.docker`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE`, `EVOLUTION_API_KEY`, `N8N_ENCRYPTION_KEY`, `N8N_USER_MANAGEMENT_JWT_SECRET`, `POSTGRES_PASSWORD`, `OPENAI_API_KEY` se usar IA/audio

Antes de ativar o bot no Mac, aplique as migrations Supabase, incluindo:

```text
supabase/migrations/20260715120000_whatsapp_bot_memory_and_dedupe.sql
```

Essa migration cria memoria temporaria por telefone/instancia, deduplicacao por `message_id` e controle de notificacao de status para impedir loop de pedido finalizado.
