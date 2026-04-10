/**
 * Simple server without Puppeteer - for Render deployment
 * Timers work, but no market price scraping
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 5050;

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

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  // Serve static files
  let urlPath = req.url.split("?")[0];
  if (urlPath === "/" || urlPath === "") urlPath = "/index.html";

  const ext = path.extname(urlPath);
  const contentType = MIME[ext];

  if (contentType) {
    serveFile(res, path.join(__dirname, urlPath), contentType);
    return;
  }

  // API endpoints (disabled - no scraping)
  if (req.url === "/compare" || req.url === "/search" || req.url === "/search-all") {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      error: "Market price search is disabled in cloud mode. Please use the desktop app for full features."
    }));
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n========================================`);
  console.log(`   Dessert Cafe Manager (Cloud)`);
  console.log(`========================================`);
  console.log(`   URL: http://localhost:${PORT}`);
  console.log(`========================================\n`);
});
