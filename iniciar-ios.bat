@echo off
title Thragg Pro Tracker - iOS Native App (Expo Go)
cd /d "%~dp0\mobile"

echo ======================================================
echo    🔱 THRAGG PRO TRACKER - APP NATIVA IOS (EXPO GO)
echo ======================================================
echo.
echo 1. Abre la app "Expo Go" en tu iPhone.
echo 2. Escanea el codigo QR que aparecera a continuacion.
echo 3. Tu app nativa de iOS se cargara al instante con:
echo    - Rueda nativa oficial de Apple (UIPickerView a 120Hz)
echo    - Motor haptico real Taptic Engine
echo    - Selector directo de dias (Lunes, Martes, Jueves, Viernes)
echo    - Tus 13 entrenos guardados intactos
echo.
echo Iniciando servidor Expo Go (limpiando cache)...
echo.

call npx expo start --go -c

pause
