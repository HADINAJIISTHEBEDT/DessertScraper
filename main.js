#!/usr/bin/env node
/**
 * Dessert Cafe Manager - Single Executable Entry Point
 * This file packages the server and opens the browser automatically
 */

const { exec } = require('child_process');
const path = require('path');
const http = require('http');

if (process.env.RENDER || process.env.PORT) {
  require('./server.js');
  return;
}

const PORTS_TO_TRY = [5050, 5051, 5052, 5053, 8080, 3000];
const SERVER_FILE = path.join(__dirname, 'server.js');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Check if server is already running
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

// Open browser
function openBrowser(url) {
  const platform = process.platform;
  let command;

  if (platform === 'win32') {
    command = `start "" "${url}"`;
  } else if (platform === 'darwin') {
    command = `open "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }

  exec(command, (err) => {
    if (err) {
      log(`Could not open browser. Please open manually: ${url}`, 'yellow');
    }
  });
}

// Start the server
async function startServer() {
  log('\n========================================', 'cyan');
  log('   Dessert Cafe Manager', 'cyan');
  log('========================================\n', 'cyan');

  // Check if server already running
  for (const port of PORTS_TO_TRY) {
    if (await isServerRunning(port)) {
      log(`Server already running on port ${port}!`, 'green');
      log(`Opening browser...`, 'yellow');
      openBrowser(`http://localhost:${port}`);
      return;
    }
  }

  // Find available port
  const port = await findAvailablePort();
  if (!port) {
    log('No available ports found!', 'red');
    process.exit(1);
  }

  log(`Starting server on port ${port}...`, 'yellow');

  // Start server process
  const serverProcess = exec(`node "${SERVER_FILE}"`, {
    cwd: __dirname,
    windowsHide: true
  });

  serverProcess.stdout.on('data', (data) => {
    process.stdout.write(data);
  });

  serverProcess.stderr.on('data', (data) => {
    process.stderr.write(data);
  });

  // Wait for server to start
  let attempts = 0;
  const maxAttempts = 300;

  const checkServer = setInterval(async () => {
    attempts++;

    if (await isServerRunning(port)) {
      clearInterval(checkServer);
      log(`\n✓ Server started successfully!`, 'green');
      log(`✓ Opening browser...`, 'green');
      openBrowser(`http://localhost:${port}`);
      log(`\nPress Ctrl+C to stop the server\n`, 'yellow');
    } else if (attempts >= maxAttempts) {
      clearInterval(checkServer);
      log('Server failed to start within timeout', 'red');
      process.exit(1);
    }
  }, 500);

  // Handle process termination
  process.on('SIGINT', () => {
    log('\n\nShutting down server...', 'yellow');
    serverProcess.kill();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    serverProcess.kill();
    process.exit(0);
  });
}

// Run
startServer().catch(err => {
  log(`Error: ${err.message}`, 'red');
  process.exit(1);
});
