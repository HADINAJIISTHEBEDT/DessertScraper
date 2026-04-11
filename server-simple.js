const http = require("http");
const fs = require("fs");
const path = require("path");
const https = require("https");

const PORT = process.env.PORT || 5050;
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;

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

async function scrapeWithApi(url) {
  if (!SCRAPER_API_KEY) return null;

  const apiUrl = `https://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(url)}&country_code=tr`;

  return new Promise((resolve) => {
    const req = https.get(apiUrl, { timeout: 25000 }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
  });
}

function extractPrice(text) {
  if (!text) return null;
  const patterns = [/₺\s*([\d.,]+)/, /([\d.,]+)\s*TL/i, /([\d.,]+)\s*₺/];
  for (const pattern of patterns) {
    const m = String(text).match(pattern);
    if (m) {
      const val = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
      if (!isNaN(val) && val > 0.5 && val < 10000) return val;
    }
  }
  return null;
}

function isValidName(name) {
  if (!name || name.length < 3) return false;
  if (/^[\d.,]+$/.test(name)) return false;
  if (name.toLowerCase() === "adet" || name.toLowerCase() === "kategori")
    return false;
  return true;
}

function parseProducts(html, market) {
  const items = [];
  const seen = new Set();

  // Try JSON-LD
  const jsonLdMatches =
    html.match(
      /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
    ) || [];
  for (const match of jsonLdMatches) {
    try {
      const content = match.replace(/<script[^>]*>|<\/script>/gi, "");
      const json = JSON.parse(content);
      const products = Array.isArray(json) ? json : [json];
      for (const p of products) {
        if (p["@type"] === "Product" && p.name) {
          const price = extractPrice(p.offers?.price || p.price);
          if (price && isValidName(p.name)) {
            const key = p.name.toLowerCase().substring(0, 30);
            if (!seen.has(key)) {
              seen.add(key);
              items.push({
                market,
                name: p.name.substring(0, 100),
                price,
                image: p.image || "",
              });
            }
          }
        }
      }
    } catch (e) {}
  }

  if (items.length > 0) return items.slice(0, 10);

  // Fallback: regex extraction
  const priceRegex = /([\d]+[.,][\d]{2})\s*(?:TL|₺)/gi;
  const nameRegex = /<h[2-6][^>]*>([^<]{3,80})<\/h[2-6]>/gi;

  const prices = [];
  const names = [];

  let m;
  while ((m = priceRegex.exec(html)) !== null) prices.push(extractPrice(m[0]));
  while ((m = nameRegex.exec(html)) !== null) {
    const name = m[1].trim();
    if (isValidName(name)) names.push(name);
  }

  for (let i = 0; i < Math.min(names.length, prices.length, 10); i++) {
    if (names[i] && prices[i]) {
      const key = names[i].toLowerCase().substring(0, 30);
      if (!seen.has(key)) {
        seen.add(key);
        items.push({
          market,
          name: names[i].substring(0, 100),
          price: prices[i],
          image: "",
        });
      }
    }
  }

  return items;
}

function getMockData(product, market) {
  return [
    {
      market,
      name: `${product} - ${market} Ürün 1`,
      price: market === "Sok" ? 25.9 : 27.5,
      image: "",
    },
    {
      market,
      name: `${product} - ${market} Ürün 2`,
      price: market === "Sok" ? 32.5 : 30.0,
      image: "",
    },
  ];
}

async function scrapeSok(product) {
  const html = await scrapeWithApi(
    `https://www.sokmarket.com.tr/arama?q=${encodeURIComponent(product)}`,
  );
  if (!html) return getMockData(product, "Sok");
  const items = parseProducts(html, "Sok");
  return items.length > 0 ? items : getMockData(product, "Sok");
}

async function scrapeCarrefour(product) {
  const html = await scrapeWithApi(
    `https://www.carrefoursa.com/search/?q=${encodeURIComponent(product)}`,
  );
  if (!html) return getMockData(product, "Carrefour");
  const items = parseProducts(html, "Carrefour");
  return items.length > 0 ? items : getMockData(product, "Carrefour");
}

async function searchMultiple(product) {
  const [sok, carrefour] = await Promise.all([
    scrapeSok(product).catch(() => getMockData(product, "Sok")),
    scrapeCarrefour(product).catch(() => getMockData(product, "Carrefour")),
  ]);
  return { sok, carrefour };
}

async function compareIngredients(ingredients) {
  const rows = [];
  let sokTotal = 0,
    carrefourTotal = 0;

  for (const ing of ingredients) {
    const name = String(ing.name || "").trim();
    const quantity = Number(ing.quantity || 0);
    if (!name || quantity <= 0) continue;

    const [sokItems, carrefourItems] = await Promise.all([
      scrapeSok(name),
      scrapeCarrefour(name),
    ]);
    const sokUnit = sokItems[0]?.price || null;
    const carrefourUnit = carrefourItems[0]?.price || null;
    const sokCost = sokUnit ? sokUnit * quantity : null;
    const carrefourCost = carrefourUnit ? carrefourUnit * quantity : null;

    if (sokCost) sokTotal += sokCost;
    if (carrefourCost) carrefourTotal += carrefourCost;

    rows.push({
      ingredient: name,
      quantity,
      sok: { unitPrice: sokUnit, cost: sokCost },
      carrefour: { unitPrice: carrefourUnit, cost: carrefourCost },
    });
  }

  const markets = [];
  if (sokTotal > 0) markets.push({ name: "Sok", total: sokTotal });
  if (carrefourTotal > 0)
    markets.push({ name: "Carrefour", total: carrefourTotal });
  markets.sort((a, b) => a.total - b.total);

  return {
    rows,
    totals: { sok: sokTotal, carrefour: carrefourTotal },
    cheapestMarket: markets[0]?.name || "N/A",
    cheapestTotal: markets[0]?.total || null,
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

  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
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
        else if (req.url === "/search") {
          if (data.market === "sok") result = await scrapeSok(data.product);
          else result = await scrapeCarrefour(data.product);
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result || {}));
      } catch (e) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

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
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
