const http = require("http");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const os = require("os");
const {
  compareIngredients,
  searchProduct,
  searchMultiple,
} = require("./scraper");

const PORTS_TO_TRY = [5050, 5051, 5052, 5053, 8080, 3000];
const IS_PRODUCTION =
  process.env.NODE_ENV === "production" || process.env.RENDER;

// Get local IP address for network access
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and non-IPv4 addresses
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

function corsHeaders(req) {
  const origin = (req && req.headers && req.headers["origin"]) || "";
  const allow =
    origin === "null" ||
    origin === "" ||
    /^https?:\/\/(localhost|127\.0\.0\.1)/.test(origin)
      ? origin || "*"
      : "*";
  return {
    "Access-Control-Allow-Origin": allow,
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
  if (IS_PRODUCTION) return; // Don't open browser in production

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

function startServer(port) {
  const server = http.createServer((req, res) => {
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
    const localUrl = `http://localhost:${port}`;
    const networkUrl = `http://${getLocalIP()}:${port}`;

    console.log(`\n========================================`);
    console.log(`   Dessert Cafe Manager is running!`);
    console.log(`========================================`);
    console.log(`   Local:   ${localUrl}`);
    console.log(`   Network: ${networkUrl}`);
    console.log(`========================================\n`);

    // Auto-open browser only in local development
    if (!IS_PRODUCTION) {
      setTimeout(() => {
        openBrowser(localUrl);
      }, 1000);
    }
  });
}

// Production: Use PORT from environment
if (IS_PRODUCTION && process.env.PORT) {
  startServer(parseInt(process.env.PORT, 10));
} else {
  // Local development: Try ports
  function tryPorts(ports, index = 0) {
    if (index >= ports.length) {
      console.error("No available ports found!");
      return;
    }

    const port = ports[index];
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

  tryPorts(PORTS_TO_TRY);
}
