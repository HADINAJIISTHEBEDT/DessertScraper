@echo off
cd /d "%~dp0"
echo Starting HTTPS server...
echo.
node server-test.js
pause