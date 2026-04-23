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

if "%PORT%"=="" (
    set PORT=13000
)

if exist "migros-local.env.bat" (
    echo Loading local Migros settings...
    call migros-local.env.bat
    echo.
)

echo Starting server on port %PORT%...
node server.js

pause
