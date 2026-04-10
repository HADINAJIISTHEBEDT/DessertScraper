@echo off
title Uninstall Dessert Cafe Manager Service
cd /d "%~dp0"

echo ========================================
echo   Uninstalling Dessert Cafe Manager
echo   Windows Service
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

echo Uninstalling service...
node uninstall-service.js

echo.
pause
