@echo off
setlocal
cd /d "%~dp0"

echo.
echo ==============================================
echo   GerenteMarketing - inicializacao local
echo ==============================================
echo.

echo [1/3] Iniciando Postgres e Redis...
docker compose up -d postgres redis
if errorlevel 1 (
  echo.
  echo [ERRO] Nao foi possivel iniciar Postgres/Redis.
  echo Abra o Docker Desktop e execute este arquivo novamente.
  echo.
  pause
  exit /b 1
)

call :ensure_service 4000 "GerenteMarketing API" "@gerentemarketing/api"
call :ensure_service 3000 "GerenteMarketing Web" "@gerentemarketing/web"

echo.
echo [3/3] Ambiente iniciado.
echo API: http://localhost:4000
echo Web: http://localhost:3000
echo.
echo Se uma janela de servico for fechada, execute este arquivo novamente:
echo ele inicia apenas o que estiver faltando.
echo.

timeout /t 3 /nobreak >nul
start "" "http://localhost:3000"
exit /b 0

:ensure_service
set "PORT=%~1"
set "TITLE=%~2"
set "WORKSPACE=%~3"

powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if %errorlevel%==0 (
  echo [%TITLE%] ja esta rodando na porta %PORT%.
  exit /b 0
)

echo [%TITLE%] iniciando na porta %PORT%...
start "%TITLE%" cmd.exe /k "npm.cmd run dev --workspace %WORKSPACE%"
exit /b 0
