@echo off
title Install Dessert Cafe Manager Service
cd /d "%~dp0"

echo ========================================
echo   Installing Dessert Cafe Manager
echo   as Windows Service
echo ========================================
echo.

:: Check for admin rights
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Please run as Administrator!
    echo Right-click this file and select "Run as administrator"
    pause
    exit /b 1
)

echo Installing Node.js service...

:: Install node-windows if not present
if not exist "node_modules\node-windows" (
    echo Installing dependencies...
    call npm install node-windows
)

:: Run install script
node install-service.js

echo.
echo Installation complete!
echo The service will start automatically on Windows boot.
pause
