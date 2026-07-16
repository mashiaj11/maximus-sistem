# Maximus Sistema

Sistema da Maximus Hamburgueria com Admin, Public, Electron, Supabase, n8n, Evolution API, PostgreSQL, Redis e scripts de operacao para Windows.

## Estrutura

- `maximus-admin`: painel administrativo React/Vite/TanStack e aplicativo Electron.
- `maximus-public`: cardapio e fluxo publico de pedidos.
- `supabase/migrations`: migrations SQL versionaveis.
- `n8n/workflows`: workflows sanitizados para importacao.
- `setup-windows`: scripts PowerShell para instalar, iniciar, parar e atualizar.
- `docs`: guias tecnicos e operacionais.
- `release/windows`: pacote local de entrega, sem segredos reais.

## Pre-requisitos

Windows 10/11 x64, PowerShell, Git, Node.js 22 LTS, npm, Docker Desktop com Docker Compose e pelo menos 10 GB livres.

## Instalacao no Windows

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\setup-windows\VERIFICAR-SISTEMA.ps1
.\setup-windows\INSTALAR-MAXIMUS.ps1
```

Depois edite `.env` com os valores reais de Supabase, n8n, Evolution API e OpenAI quando aplicavel.

## Inicializacao e Encerramento

```powershell
.\setup-windows\INICIAR-MAXIMUS.ps1
.\setup-windows\PARAR-MAXIMUS.ps1
```

O script de parada usa `docker compose stop` e nao apaga volumes.

## Atualizacao pelo Git

```powershell
.\setup-windows\ATUALIZAR-MAXIMUS.ps1
```

O script interrompe se houver alteracoes locais para evitar perda de trabalho.

## Build

```powershell
npm run build
npm run build:windows
npm run dist:windows
```

O instalador Windows e gerado pelo `electron-builder` dentro do Admin. O GitHub Actions tambem gera artifact em Windows.

## Docker e Portas

- Admin dev: `127.0.0.1:8080`
- Public dev: `127.0.0.1:8081`
- n8n: `127.0.0.1:5678`
- Evolution API: `127.0.0.1:8082`
- Postgres/Redis: expostos apenas na rede interna Docker.

## n8n, Evolution API e Supabase

Leia `n8n/README.md`, `docs/SEGREDOS-E-VARIAVEIS.md` e `docs/BANCO-DE-DADOS.md` antes de operar. Workflows precisam de credenciais recriadas no n8n local.

## Backup e Restauracao

Leia `docs/BACKUP-E-RESTAURACAO.md`. Nunca rode `DROP`, `TRUNCATE`, reset de banco ou `docker compose down -v` em producao sem backup testado.

## Logs

Os scripts gravam logs em `logs/`. O Electron grava logs de impressao e atualizacao no diretorio de dados do usuario do Windows.

## Seguranca

Arquivos `.env`, backups locais, builds, instaladores e volumes Docker sao ignorados pelo Git. Use apenas `.env.example` para documentar variaveis.
