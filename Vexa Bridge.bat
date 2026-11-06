@echo off
title Vexa Bridge
echo ______________________________________________
echo   Vexa Bridge - Local connection to Roblox Studio
echo   Opens a local port and listens in the background.
echo   Roblox Studio connects here via HTTP requests.
echo   Close this window to stop the bridge.
echo ______________________________________________
echo.

set "SCRIPT_DIR=%~dp0"

set "NODE="
if exist "%SCRIPT_DIR%node-runtime\node.exe" set "NODE=%SCRIPT_DIR%node-runtime\node.exe"
if not defined NODE (
  for %%i in (node.exe) do set "NODE=%%~$PATH:i"
)
if not defined NODE (
  if exist "%ProgramFiles%\nodejs\node.exe" set "NODE=%ProgramFiles%\nodejs\node.exe"
)
if not defined NODE (
  if exist "%LocalAppData%\Programs\nodejs\node.exe" set "NODE=%LocalAppData%\Programs\nodejs\node.exe"
)
if not defined NODE (
  echo.
  echo  [ERROR] Node.js not found.
  echo  Install it from https://nodejs.org then run this file again.
  echo.
  pause
  exit /b 1
)

set "BRIDGE=%SCRIPT_DIR%bridge\vexa-bridge.mjs"
if not exist "%BRIDGE%" (
  echo.
  echo  [ERROR] bridge\vexa-bridge.mjs not found next to this file.
  echo.
  pause
  exit /b 1
)

echo  Installing Vexa Studio plugin...
set "PLUGIN_SRC=%SCRIPT_DIR%bridge\studio-plugin\Vexa"
set "PLUGIN_DST=%LocalAppData%\Roblox\Plugins\Vexa"
if exist "%PLUGIN_SRC%" (
  if not exist "%LocalAppData%\Roblox\Plugins" (
    mkdir "%LocalAppData%\Roblox\Plugins" 2>nul
  )
  if not exist "%PLUGIN_DST%" mkdir "%PLUGIN_DST%" 2>nul
  xcopy /e /i /y "%PLUGIN_SRC%" "%PLUGIN_DST%" >nul 2>nul
  echo  Vexa Studio plugin: %PLUGIN_DST%\init.lua
  echo  (Riapri Roblox Studio una volta se il plugin non e' ancora visibile.)
) else (
  echo  [WARN] plugin sorgente non trovato: "%PLUGIN_SRC%"
)

echo  Starting bridge on port 8765...
echo.

"%NODE%" "%BRIDGE%"

echo.
echo  Bridge stopped.
pause