$ErrorActionPreference = "SilentlyContinue"
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$ws = New-Object -ComObject WScript.Shell
$shortcut = $ws.CreateShortcut("$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\DessertScraper.lnk")
$shortcut.TargetPath = "powershell.exe"
$shortcut.Arguments = "-WindowStyle Hidden -File `"$scriptPath\run-server.ps1`""
$shortcut.WorkingDirectory = $scriptPath
$shortcut.Description = "Dessert Scraper Server"
$shortcut.Save()
Write-Host "Added to Windows startup!"
