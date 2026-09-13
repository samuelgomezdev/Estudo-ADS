@echo off
chcp 65001 >nul
title Estudo ADS - atualizar e publicar
cd /d "%~dp0"
echo.
echo  ============================================
echo   ESTUDO ADS - UNIVALI
echo   Gerando o site e publicando no GitHub
echo  ============================================
echo.

rem ---------- 1. gerar o site ----------
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

rem ---------- 2. publicar no GitHub ----------
echo.
echo  --------------------------------------------
echo   Publicando no GitHub Pages...
echo  --------------------------------------------
where git >nul 2>&1
if %errorlevel% neq 0 (
  echo  [AVISO] git nao encontrado no PATH. Pulei a publicacao.
  echo          O site foi gerado localmente, mas nao foi enviado ao GitHub.
  goto abrir
)

git add -A
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "atualiza site (%date% %time%)"
  git push
  if errorlevel 1 (
    echo.
    echo  [AVISO] git push falhou. Veja a mensagem acima.
    echo          Talvez seja preciso rodar "gh auth login" uma vez.
  ) else (
    echo.
    echo  Publicado. O site atualiza em ate 1-2 minutos:
    echo    https://samuelgomezdev.github.io/Estudo-ADS/
  )
) else (
  echo  Nada novo para publicar - o site ja estava atualizado.
)

:abrir
rem ---------- 3. abrir a versao local ----------
echo.
echo  Pronto. Abrindo o site local...
ping -n 2 127.0.0.1 >nul
start "" "index.html"
