@echo off
title SMN SWEET'S Billing System
cd /d "%~dp0"

echo ===================================================
echo   SMN SWEET'S - Traditional Taste ^& Purity
echo   Starting Billing ^& PDF Invoice Management System...
echo ===================================================

:: Start local backend server silently if not running
start /b "" node server/server.js

:: Wait 1.5 seconds for server to bind
timeout /t 2 /nobreak >nul

:: Launch Electron Desktop Application if available, otherwise launch native app window in Edge/Chrome
where electron >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  start "" electron electron/main.js
) else (
  if exist "node_modules\.bin\electron.cmd" (
    start "" "node_modules\.bin\electron.cmd" electron/main.js
  ) else (
    :: Fallback to Windows native Edge App Mode (Chromium kiosk window, zero browser bars)
    start "" msedge --app="http://127.0.0.1:4000" --window-size=1366,850
  )
)

exit

