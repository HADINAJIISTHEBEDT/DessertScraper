@echo off
echo Installing DessertScraper Server to Windows startup...
copy "%~dp0start-server.bat" "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\DessertScraper.bat"
echo Done! Server will auto-start with Windows.
pause
