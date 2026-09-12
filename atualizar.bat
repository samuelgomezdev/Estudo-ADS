@echo off
chcp 65001 >nul
title Estudo ADS - atualizar site
cd /d "%~dp0"
echo.
echo  ============================================
echo   ESTUDO ADS - UNIVALI
echo   Varrendo a pasta Univali e gerando o site
echo  ============================================
echo.

where py >nul 2>&1
if %errorlevel%==0 (
  py gerar.py
) else (
  where python >nul 2>&1
  if %errorlevel%==0 (
    python gerar.py
  ) else (
    echo  [ERRO] Python nao encontrado.
    echo  Instale em https://python.org e marque "Add Python to PATH".
    echo.
    pause
    exit /b 1
  )
)

if %errorlevel% neq 0 (
  echo.
  echo  [ERRO] Algo deu errado ao gerar. Veja a mensagem acima.
  pause
  exit /b 1
)

echo.
echo  Pronto. Abrindo o site...
timeout /t 1 >nul
start "" "index.html"
