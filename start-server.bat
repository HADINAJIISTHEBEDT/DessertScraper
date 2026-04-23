@echo off
cd /d "%~dp0"
if "%PORT%"=="" set PORT=13000
if exist "migros-local.env.bat" call migros-local.env.bat
REM Use start /b to run in background, and loop to restart on crash
:loop
start /b /min node server.js
waitfor /t 3600 NonExistentSignal_KeepAlive >nul 2>&1
goto loop
