/**
 * Dessert Cafe Manager - Windows Service
 * Runs in background, starts automatically on boot
 */

const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const PORTS_TO_TRY = [5050, 5051, 5052, 5053, 8080, 3000];
const SERVER_FILE = path.join(__dirname, 'server.js');

let serverProcess = null;
let currentPort = null;

// Check if server is running
async function isServerRunning(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// Find available port
async function findAvailablePort() {
  for (const port of PORTS_TO_TRY) {
    const running = await isServerRunning(port);
    if (!running) {
      return port;
    }
  }
  return null;
}

// Start server
async function startServer() {
  if (serverProcess) {
    console.log('Server already running');
    return;
  }

  const port = await findAvailablePort();
  if (!port) {
    console.error('No available ports found!');
    return;
  }

  currentPort = port;
  console.log(`Starting server on port ${port}...`);

  serverProcess = spawn('node', [SERVER_FILE], {
    cwd: __dirname,
    windowsHide: true,
    env: { ...process.env, PORT: port.toString() }
  });

  serverProcess.stdout.on('data', (data) => {
    console.log(`[Server] ${data.toString().trim()}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`[Server Error] ${data.toString().trim()}`);
  });

  serverProcess.on('exit', (code) => {
    console.log(`Server exited with code ${code}`);
    serverProcess = null;
    // Auto-restart after 5 seconds
    setTimeout(startServer, 5000);
  });

  // Wait for server to be ready
  let attempts = 0;
  const checkInterval = setInterval(async () => {
    attempts++;
    if (await isServerRunning(port)) {
      clearInterval(checkInterval);
      console.log(`✓ Server ready at http://localhost:${port}`);
    } else if (attempts > 30) {
      clearInterval(checkInterval);
      console.error('Server failed to start');
    }
  }, 500);
}

// Stop server
function stopServer() {
  if (serverProcess) {
    console.log('Stopping server...');
    serverProcess.kill();
    serverProcess = null;
  }
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  stopServer();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopServer();
  process.exit(0);
});

// Start
console.log('========================================');
console.log('   Dessert Cafe Manager Service');
console.log('========================================\n');
startServer();
