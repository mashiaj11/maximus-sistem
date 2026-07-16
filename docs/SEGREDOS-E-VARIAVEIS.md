# Segredos e Variaveis

Nunca versionar `.env` real.

## Publicas

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Essas aparecem no navegador e devem ser chaves publicas/publishable.

## Privadas

- `SUPABASE_SERVICE_ROLE`
- `EVOLUTION_API_KEY`
- `N8N_ENCRYPTION_KEY`
- `N8N_USER_MANAGEMENT_JWT_SECRET`
- `POSTGRES_PASSWORD`
- `N8N_POSTGRES_PASSWORD`
- `EVOLUTION_POSTGRES_PASSWORD`
- `OPENAI_API_KEY`

Use apenas em `.env` local, Docker ou painel seguro. Troque qualquer segredo que ja tenha sido exposto em commit, backup ou mensagem.
