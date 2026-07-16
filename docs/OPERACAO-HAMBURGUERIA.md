# Operacao da Hamburgueria

## Ligar

Abra PowerShell na pasta do sistema e execute:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\setup-windows\INICIAR-MAXIMUS.ps1
```

## Abrir Admin

Use o atalho "Abrir Maximus Admin" se existir. Se nao existir, abra `http://127.0.0.1:8080`.

## Conferir bot

Abra `http://127.0.0.1:5678`, confira se os workflows estao ativos e se a Evolution API aparece conectada. Envie uma mensagem de teste para o WhatsApp configurado.

## Conferir impressao

No Admin, abra a tela de impressao e rode um teste na impressora correta. Verifique os logs quando falhar.

## Conferir pedidos

Abra o Admin e confira se pedidos novos aparecem. No Public, faca um pedido de teste se a unidade estiver em horario permitido.

## Reiniciar servicos

```powershell
.\setup-windows\PARAR-MAXIMUS.ps1
.\setup-windows\INICIAR-MAXIMUS.ps1
```

## Quando faltar internet

O Admin pode abrir, mas WhatsApp, Supabase e pedidos online podem falhar. Aguarde a internet voltar e reinicie os servicos se necessario.

## Quando Docker nao iniciar

Abra o Docker Desktop manualmente. Se continuar falhando, reinicie o Windows e rode `.\setup-windows\VERIFICAR-SISTEMA.ps1`.

## Logs

Logs dos scripts ficam em `logs/`. Logs de impressao ficam no diretorio de dados do aplicativo Electron.
