$port = 5050
$maxPort = 5053
$ports = $port..$maxPort

function Test-Port {
    param($p)
    $tcp = New-Object System.Net.Sockets.TcpClient
    $tcp.Connect("127.0.0.1", $p)
    $tcp.Close()
    $tcp.Dispose()
}

$runningPort = $null
foreach ($p in $ports) {
    try {
        Test-Port $p
    } catch {
        $runningPort = $p
        break
    }
}

if ($null -eq $runningPort) {
    $env:PORT_FALLBACK = "5050"
}

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptPath
node server.js
