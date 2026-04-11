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

function getMockData(product, market) {
  return [
    {
      market,
      name: `${product} - ${market} Product 1`,
      price: market === "Sok" ? 25.9 : 27.5,
      image: "",
    },
    {
      market,
      name: `${product} - ${market} Product 2`,
      price: market === "Sok" ? 32.5 : 30.0,
      image: "",
    },
  ];
}

async function searchMultiple(product) {
  return {
    sok: getMockData(product, "Sok"),
    carrefour: getMockData(product, "Carrefour"),
  };
}

async function compareIngredients(ingredients) {
  const rows = [];
  let sokTotal = 0,
    carrefourTotal = 0;
  for (const ing of ingredients) {
    const name = String(ing.name || "").trim();
    const quantity = Number(ing.quantity || 0);
    if (!name || quantity <= 0) continue;
    const sokUnit = 25.9,
      carrefourUnit = 27.5;
    const sokCost = sokUnit * quantity,
      carrefourCost = carrefourUnit * quantity;
    sokTotal += sokCost;
    carrefourTotal += carrefourCost;
    rows.push({
      ingredient: name,
      quantity,
      sok: { unitPrice: sokUnit, cost: sokCost },
      carrefour: { unitPrice: carrefourUnit, cost: carrefourCost },
    });
  }
  return {
    rows,
    totals: { sok: sokTotal, carrefour: carrefourTotal },
    cheapestMarket: sokTotal < carrefourTotal ? "Sok" : "Carrefour",
    cheapestTotal: Math.min(sokTotal, carrefourTotal),
  };
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
          result = getMockData(data.product, data.market || "Sok");
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
