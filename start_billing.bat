@echo off
title SMN SWEET'S — Billing & WhatsApp Bot Launcher
echo ========================================================
echo   SMN SWEET'S Billing & WhatsApp Bot System
echo   Sukhadiya Manilal Nathalal - Since 1849
echo ========================================================
echo.
cd /d "%~dp0"

echo Starting SMN Sweets Backend Server (Port 4000)...
echo Starting Built-in WhatsApp Bot Service (Port 3001)...
echo.
echo Opening billing dashboard in your browser...
start "" "http://127.0.0.1:4000"

node server/server.js
pause
