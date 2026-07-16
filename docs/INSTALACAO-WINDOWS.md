# Instalacao no Windows

1. Instale Docker Desktop, Git e Node.js 22 LTS.
2. Clone o repositorio.
3. Abra PowerShell na pasta do projeto.
4. Execute:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\setup-windows\VERIFICAR-SISTEMA.ps1
.\setup-windows\INSTALAR-MAXIMUS.ps1
```

5. Edite `.env`.
6. Execute:

```powershell
.\setup-windows\INICIAR-MAXIMUS.ps1
```

Se Docker Desktop nao estiver aberto, abra-o e espere ficar verde antes de iniciar.
