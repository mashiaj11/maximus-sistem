# Solucao de Problemas

## Docker nao responde

Abra Docker Desktop, aguarde inicializar e execute `docker compose ps`.

## Porta em uso

Execute `.\setup-windows\VERIFICAR-SISTEMA.ps1`. Feche o processo que estiver usando 8080, 8081, 5678 ou 8082.

## Admin nao abre

Rode `npm --prefix maximus-admin run build`. Se falhar, veja `logs/inicio.log` e `maximus-admin` para erros.

## Public nao abre

Rode `npm --prefix maximus-public run build` e confira variaveis `VITE_SUPABASE_*`.

## WhatsApp nao envia

Confira `EVOLUTION_API_KEY`, instancia da Evolution API, workflow ativo no n8n e credenciais recriadas.

## Impressao falha

Confira se a impressora esta instalada no Windows, se o nome selecionado no Admin e correto e veja logs de impressao.
