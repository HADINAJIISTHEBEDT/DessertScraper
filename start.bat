@echo off
title Dessert Cafe Manager
cd /d "%~dp0"

echo ========================================
echo   Dessert Cafe Manager - Starting...
echo ========================================
echo.

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    echo.
)

if not exist "server.key" (
    echo Generating HTTPS certificate...
    node generate-cert.js
    echo.
)

echo Starting server...
node server-https.js

pause
