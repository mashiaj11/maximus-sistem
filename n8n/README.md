# n8n Maximus

Workflows incluidos:

- `2-maximus-ia.json`: atendimento automatico, recebimento/envio de mensagens, Supabase, Evolution API, memoria de conversa, audio/imagem quando configurado, deduplicacao por `message_id`.
- `status-pedido-whatsapp.json`: notificacoes de mudanca de status e marcacao de envio para impedir looping.

Antes de importar, preencha `.env` com:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE`
- `EVOLUTION_API_KEY`
- `EVOLUTION_INSTANCE_NAME`
- `OPENAI_API_KEY`, se usar IA/transcricao.

As credenciais precisam ser recriadas no n8n depois da importacao. Os workflows versionados nao devem conter IDs de credenciais, tokens, sessoes ou chaves reais.

Importacao local no container:

```bash
docker compose exec n8n n8n import:workflow --input=/workflows/2-maximus-ia.json
docker compose exec n8n n8n import:workflow --input=/workflows/status-pedido-whatsapp.json
```

Depois, abra `http://127.0.0.1:5678`, confira credenciais e ative os workflows.

## Evolution API

Configure a credencial HTTP com `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` e `EVOLUTION_INSTANCE_NAME`. Teste envio e recebimento com uma mensagem simples antes de ativar atendimento automatico.

## Anti-loop e deduplicacao

- O workflow de status deve marcar pedidos ja enviados para impedir loop de "pedido finalizado".
- A deduplicacao por `message_id` deve ser validada enviando a mesma mensagem mais de uma vez.
- Confira sessoes do bot nas tabelas/RPCs de memoria antes de concluir testes.
