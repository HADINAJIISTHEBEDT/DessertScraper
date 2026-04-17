const http = require("http");
const fs = require("fs");
const path = require("path");

const {
  compareIngredients,
  searchProduct,
  searchMultiple,
} = require("./scraper");

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
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
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

  if (req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const data = JSON.parse(body || "{}");
        let result;
        if (req.url === "/search-all")
          result = await searchMultiple(data.product);
        else if (req.url === "/compare")
          result = await compareIngredients(data.ingredients || []);
        else if (req.url === "/search")
          result = await searchProduct(data.product, data.market || "sok");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result || {}));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});

server.on("error", (err) => {
  console.error("Server error:", err);
});