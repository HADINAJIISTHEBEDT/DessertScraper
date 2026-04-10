const http = require("http");
const fs = require("fs");
const path = require("path");
const { compareIngredients, searchMultiple } = require("./scraper");

const PORTS_TO_TRY = [5050, 5051, 5052, 5053, 8080];
const IS_PRODUCTION = process.env.NODE_ENV === "production" || process.env.RENDER;

function corsHeaders(req) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
};

const server = http.createServer(async (req, res) => {
  // 1. CORS Preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders(req));
    res.end();
    return;
  }

  // 2. Health Check (Immediate response for the frontend)
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json", ...corsHeaders(req) });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  // 3. API Endpoints
  if (req.method === "POST") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", async () => {
      try {
        const data = JSON.parse(body);
        let result;
        if (req.url === "/compare") result = await compareIngredients(data.ingredients);
        if (req.url === "/search-all") result = await searchMultiple(data.product);
        
        res.writeHead(200, { "Content-Type": "application/json", ...corsHeaders(req) });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500, corsHeaders(req));
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // 4. Static File Server
  let urlPath = req.url === "/" ? "/index.html" : req.url;
  const filePath = path.join(__dirname, urlPath);
  const ext = path.extname(filePath);
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not Found");
    } else {
      res.writeHead(200, { "Content-Type": MIME[ext] || "text/plain" });
      res.end(data);
    }
  });
});

function startServer(index = 0) {
  if (index >= PORTS_TO_TRY.length) return console.error("No ports available.");
  const port = process.env.PORT || PORTS_TO_TRY[index];
  
  server.listen(port, () => {
    console.log(`\n>>> Dessert Manager active on port: ${port}`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') startServer(index + 1);
  });
}

startServer();