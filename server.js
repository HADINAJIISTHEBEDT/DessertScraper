"use strict";

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { exec, spawn } = require("child_process");
const { createNodeRequestListener } = require("./api-handler");

let NGROK_URL = null;

const PORTS_TO_TRY = [
  5050, 5051, 5052, 5053, 8080, 3000, 5000, 7000, 8000, 13000, 13001,
  13002, 15050, 15051, 18080,
];
const IS_PRODUCTION =
  process.env.NODE_ENV === "production" || process.env.RENDER || process.env.PORT;

const SSL_KEY = path.join(__dirname, "server.key");
const SSL_CERT = path.join(__dirname, "server.crt");
const HAS_SSL = false;

let sslOptions = null;
if (HAS_SSL) {
  try {
    sslOptions = {
      key: fs.readFileSync(SSL_KEY),
      cert: fs.readFileSync(SSL_CERT),
    };
    console.log("SSL certificates loaded - using HTTPS!");
  } catch (err) {
    console.log("Warning: Could not load SSL certificates, falling back to HTTP");
  }
} else {
  console.log("No SSL certificates found - using HTTP");
}

async function killPort(port) {
  return new Promise((resolve) => {
    if (process.platform === "win32") {
      exec(`netstat -ano | findstr :${port}`, (err, stdout) => {
        if (!stdout) {
          resolve(false);
          return;
        }

        const lines = stdout.split("\n").filter((line) => line.includes(`:${port}`));
        const pids = new Set();

        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && /^\d+$/.test(pid)) pids.add(pid);
        }

        if (!pids.size) {
          resolve(false);
          return;
        }

        let completed = 0;
        for (const pid of pids) {
          exec(`taskkill /PID ${pid} /F`, () => {
            completed += 1;
            if (completed >= pids.size) {
              setTimeout(() => resolve(true), 500);
            }
          });
        }
      });
      return;
    }

    exec(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, () => {
      setTimeout(() => resolve(true), 200);
    });
  });
}

function openBrowser(url) {
  if (IS_PRODUCTION) return;

  const platform = process.platform;
  let command;

  if (platform === "win32") {
    command = `start "" "${url}"`;
  } else if (platform === "darwin") {
    command = `open "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }

  exec(command, (err) => {
    if (err) {
      console.log("Could not auto-open browser. Please open manually:", url);
    }
  });
}

function startNgrok(port) {
  console.log("\n[NGROK] Starting tunnel...");

  try {
    const ngrok = spawn("ngrok", ["http", port.toString(), "--log", "stdout"], {
      detached: true,
      windowsHide: true,
    });

    ngrok.stdout.on("data", (data) => {
      const output = data.toString();
      const urlMatch = output.match(/https:\/\/[a-z0-9-]+\.ngrok-free\.app/);

      if (urlMatch && !NGROK_URL) {
        NGROK_URL = urlMatch[0];
        console.log("\n========================================");
        console.log("   NGROK TUNNEL ACTIVE!");
        console.log("========================================");
        console.log(`   Public URL: ${NGROK_URL}`);
        console.log(`   Local:      ${HAS_SSL ? "https" : "http"}://localhost:${port}`);
        console.log("========================================\n");

        setTimeout(() => {
          openBrowser(NGROK_URL);
        }, 500);
      }
    });

    ngrok.stderr.on("data", (data) => {
      console.error("[NGROK] Error:", data.toString());
    });

    ngrok.on("error", (err) => {
      console.log("\n[NGROK] Not installed or not in PATH.");
      console.log("[NGROK] To install: npm install -g ngrok");
      console.log("[NGROK] Then sign up at https://ngrok.com");
      console.log("[NGROK] Run: ngrok config add-authtoken YOUR_TOKEN\n");
      console.log(err.message);
    });

    ngrok.on("close", (code) => {
      console.log(`[NGROK] Process exited with code ${code}`);
    });

    ngrok.unref();
  } catch (err) {
    console.log("\n[NGROK] Failed to start:", err.message);
  }
}

function createServer() {
  const listener = createNodeRequestListener();
  return HAS_SSL ? https.createServer(sslOptions, listener) : http.createServer(listener);
}

function startServer(port) {
  const server = createServer();

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log(`Port ${port} is busy, trying next port...`);
    }
  });

  server.listen(port, "0.0.0.0", () => {
    const localUrl = `${HAS_SSL ? "https" : "http"}://localhost:${port}`;

    console.log("\n========================================");
    console.log("   Dessert Cafe Manager is running!");
    console.log("========================================");
    console.log(`   Local:   ${localUrl}`);
    console.log("========================================\n");

    if (!IS_PRODUCTION) {
      setTimeout(() => {
        openBrowser(localUrl);
      }, 1000);
    }
  });
}

if (process.env.PORT) {
  startServer(parseInt(process.env.PORT, 10));
} else {
  async function tryPorts(ports, index = 0) {
    if (index >= ports.length) {
      console.error("No available ports found!");
      console.log("\nTrying to kill processes on common ports...");
      for (const port of [5050, 8080, 3000, 5000]) {
        await killPort(port);
      }
      console.log("Retrying all ports...");
      tryPorts(ports, 0);
      return;
    }

    const port = ports[index];
    await killPort(port);

    const probe = http.createServer();
    probe.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.log(`Port ${port} is in use, trying next...`);
      }
      tryPorts(ports, index + 1);
    });

    probe.listen(port, () => {
      probe.close(() => startServer(port));
    });
  }

  console.log("Finding available port...");
  tryPorts(PORTS_TO_TRY);
}
