const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { exec, spawn } = require("child_process");
const {
  compareIngredients,
  searchProduct,
  searchMultiple,
} = require("./scraper");

let NGROK_URL = null;

const PORTS_TO_TRY = [5050, 5051, 5052, 5053, 8080, 3000, 5000, 7000, 8000, 13000, 13001, 13002, 15050, 15051, 18080];
const IS_PRODUCTION =
  process.env.NODE_ENV === "production" || process.env.RENDER || process.env.PORT;

const SSL_KEY = path.join(__dirname, "server.key");
const SSL_CERT = path.join(__dirname, "server.crt");
const HAS_SSL = false; // Temporarily disabled

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
        const lines = stdout.split("\n").filter(l => l.includes(`:${port}`));
        if (lines.length === 0) {
          resolve(false);
          return;
        }
        const pids = new Set();
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && /^\d+$/.test(pid)) {
            pids.add(pid);
          }
        }
        if (pids.size === 0) {
          resolve(false);
          return;
        }
        let killed = 0;
        let total = pids.size;
        for (const pid of pids) {
          exec(`taskkill /PID ${pid} /F`, (e) => {
            killed++;
            if (killed >= total) {
              setTimeout(() => resolve(true), 500);
            }
          });
        }
      });
    } else {
      exec(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, () => {
        setTimeout(() => resolve(true), 200);
      });
    }
  });
}

function corsHeaders(req) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function sendJson(res, status, payload, req) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    ...corsHeaders(req),
  });
  res.end(JSON.stringify(payload));
}

function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
    });
    res.end(data);
  });
}

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};

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
    if (err)
      console.log("Could not auto-open browser. Please open manually:", url);
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
        console.log("========================================");
        console.log("\nUse this URL on your phone (works from anywhere):");
        console.log(`${NGROK_URL}`);
        console.log("\n========================================\n");

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
    });

    ngrok.on("close", (code) => {
      console.log(`[NGROK] Process exited with code ${code}`);
    });

    ngrok.unref();
  } catch (err) {
    console.log("\n[NGROK] Failed to start:", err.message);
  }
}

function startServer(port) {
  const createServer = HAS_SSL ? https.createServer.bind(https, sslOptions) : http.createServer;
  const server = createServer((req, res) => {
    if (req.method === "OPTIONS") {
      sendJson(res, 200, { ok: true }, req);
      return;
    }
    if (req.method === "GET" && req.url === "/health") {
      sendJson(res, 200, { status: "ok", port }, req);
      return;
    }

    if (req.method === "GET") {
      let urlPath = req.url.split("?")[0];
      if (urlPath === "/" || urlPath === "") urlPath = "/index.html";
      const ext = path.extname(urlPath);
      const contentType = MIME[ext];
      if (contentType) {
        serveFile(res, path.join(__dirname, urlPath), contentType);
        return;
      }
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    if (req.method === "POST" && req.url === "/compare") {
      let body = "";
      req.on("data", (c) => {
        body += c.toString();
      });
      req.on("end", async () => {
        try {
          const parsed = JSON.parse(body || "{}");
          const ingredients = Array.isArray(parsed.ingredients)
            ? parsed.ingredients
            : [];
          if (!ingredients.length) {
            sendJson(res, 400, { error: "ingredients array is required" }, req);
            return;
          }
          const result = await compareIngredients(ingredients);
          sendJson(res, 200, result, req);
        } catch (err) {
          sendJson(res, 500, { error: err.message || "internal error" }, req);
        }
      });
      return;
    }

    if (req.method === "POST" && req.url === "/search") {
      let body = "";
      req.on("data", (c) => {
        body += c.toString();
      });
      req.on("end", async () => {
        try {
          const parsed = JSON.parse(body || "{}");
          const product = String(parsed.product || "").trim();
          const market = String(parsed.market || "").toLowerCase();
          if (!product) {
            sendJson(res, 400, { error: "product name is required" }, req);
            return;
          }
          if (!["sok", "carrefour"].includes(market)) {
            sendJson(
              res,
              400,
              { error: "market must be sok or carrefour" },
              req,
            );
            return;
          }
          const result = await searchProduct(product, market);
          sendJson(res, 200, result || { error: "No product found" }, req);
        } catch (err) {
          sendJson(res, 500, { error: err.message || "internal error" }, req);
        }
      });
      return;
    }

    if (req.method === "POST" && req.url === "/search-all") {
      let body = "";
      req.on("data", (c) => {
        body += c.toString();
      });
      req.on("end", async () => {
        try {
          const parsed = JSON.parse(body || "{}");
          const product = String(parsed.product || "").trim();
          if (!product) {
            sendJson(res, 400, { error: "product name is required" }, req);
            return;
          }
          const result = await searchMultiple(product);
          sendJson(res, 200, result, req);
        } catch (err) {
          sendJson(res, 500, { error: err.message || "internal error" }, req);
        }
      });
      return;
    }

    sendJson(res, 404, { error: "not found" }, req);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log(`Port ${port} is busy, trying next port...`);
    }
  });

  server.listen(port, "0.0.0.0", () => {
    const localUrl = `${HAS_SSL ? "https" : "http"}://localhost:${port}`;

    console.log(`\n========================================`);
    console.log(`   Dessert Cafe Manager is running!`);
    console.log(`========================================`);
    console.log(`   Local:   ${localUrl}`);
    console.log(`========================================\n`);

    if (!IS_PRODUCTION) {
      setTimeout(() => {
        openBrowser(localUrl);
      }, 1000);

      // Ngrok disabled - uncomment if needed
      // try {
      //   startNgrok(port);
      // } catch (err) {
      //   console.log(
      //     "\n[NGROK] Not installed. Install with: npm install -g ngrok",
      //   );
      //   console.log(
      //     "[NGROK] Then sign up at https://ngrok.com and run: ngrok config add-authtoken YOUR_TOKEN\n",
      //   );
      // }
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
    
    const testServer = http.createServer();

    testServer.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.log(`Port ${port} is in use, trying next...`);
        tryPorts(ports, index + 1);
      } else {
        tryPorts(ports, index + 1);
      }
    });

    testServer.listen(port, () => {
      testServer.close(() => {
        startServer(port);
      });
    });
  }

  console.log("Finding available port...");
  tryPorts(PORTS_TO_TRY);
}
