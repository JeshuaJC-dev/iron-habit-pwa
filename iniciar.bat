@echo off
title HabitoTracker - Rutina Thragg v3.1
cd /d "%~dp0"

echo ======================================================
echo    🔱 HabitoTracker - Rutina Thragg v3.1 (Local)
echo ======================================================
echo.
echo Iniciando servidor local...
echo.

if not exist node_modules (
    echo Instalando dependencias por primera vez...
    call npm install
)

start http://localhost:3333
node server.js

pause
