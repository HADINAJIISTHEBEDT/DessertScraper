const https = require("https");

const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;

async function scrapeWithApi(url) {
  if (!SCRAPER_API_KEY) {
    console.error("SCRAPER_API_KEY not set");
    return null;
  }

  const apiUrl = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(url)}&render=true&country_code=tr`;

  return new Promise((resolve, reject) => {
    const req = https.get(
      apiUrl.replace("http:", "https:"),
      { timeout: 30000 },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      },
    );
    req.on("error", (err) => {
      console.error("ScraperAPI error:", err.message);
      resolve(null);
    });
    req.on("timeout", () => {
      req.destroy();
      console.error("ScraperAPI timeout");
      resolve(null);
    });
  });
}

function parsePrice(text) {
  if (!text) return null;
  const patterns = [
    /₺\s*([\d.,]+)/,
    /([\d.,]+)\s*TL/i,
    /([\d]+[.,][\d]{2})/,
    /(\d+)[.,](\d+)/,
  ];

  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m) {
      const numStr = (m[1] || m[0]).replace(/\./g, "").replace(",", ".");
      const val = parseFloat(numStr);
      if (!isNaN(val) && val > 0) return val;
    }
  }
  return null;
}

function isValidProductName(name) {
  if (!name) return false;
  if (name.length < 3) return false;
  if (/^[\d.,]+$/.test(name)) return false;
  if (/^[\d.,]+[₺TL\s]*$/i.test(name)) return false;
  if (/^\d+[.,]\d+$/.test(name)) return false;
  if (name.toLowerCase() === "adet") return false;
  if (name.toLowerCase() === "kategori") return false;
  return true;
}

function extractProductsFromHtml(html, market) {
  const items = [];
  const seen = new Set();

  // Simple regex-based extraction
  const productPatterns = [
    /<a[^>]*href="[^"]*\/(?:urun|p)\/[^"]*"[^>]*>([\s\S]*?)<\/a>/gi,
    /<div[^>]*class="[^"]*product[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
  ];

  for (const pattern of productPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const block = match[1] || match[0];

      // Extract price
      const price = parsePrice(block);
      if (!price || price < 0.5) continue;

      // Extract name
      let name = "";
      const nameMatch =
        block.match(/<h[2-4][^>]*>([^<]+)<\/h[2-4]>/i) ||
        block.match(/class="[^"]*name[^"]*"[^>]*>([^<]+)</i) ||
        block.match(/class="[^"]*title[^"]*"[^>]*>([^<]+)</i) ||
        block.match(/<span[^>]*>([^<]{10,100})</i);

      if (nameMatch) {
        name = nameMatch[1].trim();
      }

      if (!isValidProductName(name)) continue;

      // Extract image
      let image = "";
      const imgMatch =
        block.match(/<img[^>]*src="([^"]+)"/i) ||
        block.match(/data-src="([^"]+)"/i);
      if (imgMatch) {
        image = imgMatch[1];
        if (image.startsWith("//")) image = "https:" + image;
      }

      const key = name.toLowerCase().substring(0, 30);
      if (!seen.has(key)) {
        seen.add(key);
        items.push({
          market: market,
          name: name.substring(0, 100),
          price,
          image,
        });
      }

      if (items.length >= 10) break;
    }
    if (items.length >= 10) break;
  }

  return items;
}

async function scrapeSok(product) {
  const url = `https://www.sokmarket.com.tr/arama?q=${encodeURIComponent(product)}`;
  console.log(`[Sok] Searching for: ${product}`);

  const html = await scrapeWithApi(url);
  if (!html) {
    console.log("[Sok] Failed to fetch, returning mock data");
    return getMockData(product, "Sok");
  }

  const items = extractProductsFromHtml(html, "Sok");
  console.log(`[Sok] Found ${items.length} items`);

  return items.length > 0 ? items : getMockData(product, "Sok");
}

async function scrapeCarrefour(product) {
  const url = `https://www.carrefoursa.com/search/?q=${encodeURIComponent(product)}`;
  console.log(`[Carrefour] Searching for: ${product}`);

  const html = await scrapeWithApi(url);
  if (!html) {
    console.log("[Carrefour] Failed to fetch, returning mock data");
    return getMockData(product, "Carrefour");
  }

  const items = extractProductsFromHtml(html, "Carrefour");
  console.log(`[Carrefour] Found ${items.length} items`);

  return items.length > 0
    ? items.slice(0, 15)
    : getMockData(product, "Carrefour");
}

function getMockData(product, market) {
  return [
    {
      market: market,
      name: `${product} - ${market} Result 1`,
      price: market === "Sok" ? 25.9 : 27.5,
      image: "",
    },
    {
      market: market,
      name: `${product} - ${market} Result 2`,
      price: market === "Sok" ? 32.5 : 30.0,
      image: "",
    },
  ];
}

async function compareIngredients(ingredients) {
  const rows = [];
  let sokTotal = 0;
  let carrefourTotal = 0;

  for (const ing of ingredients) {
    const name = String(ing.name || "").trim();
    const quantity = Number(ing.quantity || 0);
    if (!name || quantity <= 0) continue;

    const [sokItems, carrefourItems] = await Promise.all([
      scrapeSok(name),
      scrapeCarrefour(name),
    ]);

    const sokItem = sokItems[0] || null;
    const carrefourItem = carrefourItems[0] || null;

    const sokUnit = sokItem ? Number(sokItem.price) : null;
    const carrefourUnit = carrefourItem ? Number(carrefourItem.price) : null;

    const sokCost = sokUnit !== null ? sokUnit * quantity : null;
    const carrefourCost =
      carrefourUnit !== null ? carrefourUnit * quantity : null;

    if (sokCost !== null) sokTotal += sokCost;
    if (carrefourCost !== null) carrefourTotal += carrefourCost;

    rows.push({
      ingredient: name,
      quantity,
      sok: { unitPrice: sokUnit, cost: sokCost },
      carrefour: { unitPrice: carrefourUnit, cost: carrefourCost },
    });
  }

  const totals = { sok: sokTotal, carrefour: carrefourTotal };
  const hasSok = rows.some((r) => r.sok.unitPrice !== null);
  const hasCarrefour = rows.some((r) => r.carrefour.unitPrice !== null);

  let cheapestMarket = "N/A";
  let cheapestTotal = null;

  const markets = [];
  if (hasSok) markets.push({ name: "Sok", total: sokTotal });
  if (hasCarrefour) markets.push({ name: "Carrefour", total: carrefourTotal });

  if (markets.length > 0) {
    markets.sort((a, b) => a.total - b.total);
    cheapestMarket = markets[0].name;
    cheapestTotal = markets[0].total;
  }

  return { rows, totals, cheapestMarket, cheapestTotal };
}

async function searchProduct(product, market) {
  console.log(`[Search] Looking for "${product}" in ${market}`);
  if (market === "sok") return await scrapeSok(product);
  if (market === "carrefour") return await scrapeCarrefour(product);
  return null;
}

async function searchMultiple(product) {
  console.log(`[SearchAll] Looking for "${product}" in all markets`);

  try {
    const [sok, carrefour] = await Promise.all([
      scrapeSok(product).catch(() => getMockData(product, "Sok")),
      scrapeCarrefour(product).catch(() => getMockData(product, "Carrefour")),
    ]);

    return {
      sok: Array.isArray(sok) ? sok : getMockData(product, "Sok"),
      carrefour: Array.isArray(carrefour)
        ? carrefour
        : getMockData(product, "Carrefour"),
    };
  } catch (err) {
    console.error("[SearchAll] Error:", err);
    return {
      sok: getMockData(product, "Sok"),
      carrefour: getMockData(product, "Carrefour"),
      _error: err.message,
    };
  }
}

// Netlify Function handler
exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  let path = event.path || "";
  path = path.replace(/^.*\.netlify\/functions\/api/, "");
  if (event.rawPath) {
    path = event.rawPath.replace(/^.*\.netlify\/functions\/api/, "");
  }
  path = path.split("?")[0];

  console.log("Handler called - path:", path, "method:", event.httpMethod);

  let body;

  try {
    if (event.isBase64Encoded && event.body) {
      body = JSON.parse(Buffer.from(event.body, "base64").toString("utf-8"));
    } else {
      body = event.body ? JSON.parse(event.body) : {};
    }
  } catch (e) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid JSON" }),
    };
  }

  try {
    let result;

    const pathMatch =
      path.endsWith("/compare") || path === "compare"
        ? "/compare"
        : path.endsWith("/search-all") || path === "search-all"
          ? "/search-all"
          : path.endsWith("/search") || path === "search"
            ? "/search"
            : path;

    if (event.httpMethod === "POST" && pathMatch === "/compare") {
      result = await compareIngredients(body.ingredients || []);
    } else if (event.httpMethod === "POST" && pathMatch === "/search-all") {
      result = await searchMultiple(body.product);
    } else if (event.httpMethod === "POST" && pathMatch === "/search") {
      result = await searchProduct(body.product, body.market);
    } else {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "Not found", path: path }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.error("Handler error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
