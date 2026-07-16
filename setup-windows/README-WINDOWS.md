# Instalacao Windows

Execute os scripts pelo PowerShell aberto na raiz do projeto.

1. `Set-ExecutionPolicy -Scope Process Bypass`
2. `.\setup-windows\VERIFICAR-SISTEMA.ps1`
3. `.\setup-windows\INSTALAR-MAXIMUS.ps1`
4. Edite `.env` com os valores reais.
5. `.\setup-windows\INICIAR-MAXIMUS.ps1`
6. Opcional: `.\setup-windows\CRIAR-ATALHOS.ps1`

Para parar sem apagar dados:

```powershell
.\setup-windows\PARAR-MAXIMUS.ps1
```

Para atualizar preservando `.env` e volumes:

```powershell
.\setup-windows\ATUALIZAR-MAXIMUS.ps1
```
