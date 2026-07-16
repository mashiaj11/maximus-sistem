# Arquitetura

O Maximus tem duas aplicacoes Vite/TanStack: `maximus-admin` para operacao interna e `maximus-public` para clientes. O Admin tambem roda como Electron, usando um servidor Nitro local empacotado e recursos de impressao nativa.

Servicos auxiliares ficam no Docker Compose:

- n8n para automacoes e bot.
- Evolution API para WhatsApp.
- PostgreSQL separado para n8n e Evolution.
- Redis para cache/fila da Evolution.

O Supabase e o banco principal do produto. A aplicacao usa a chave publica no frontend e workflows usam `SUPABASE_SERVICE_ROLE` somente em ambiente privado.
