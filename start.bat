@echo off
title Dessert Cafe Manager
cd /d "%~dp0"

echo ========================================
echo   Dessert Cafe Manager - Starting...
echo ========================================
echo.

:: Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    echo.
)

:: Start the server (it will auto-open the browser)
echo Starting server...
echo.
echo TIP: You can open launcher.html in your browser
echo to check if the server is running.
echo.

node server.js

pause
