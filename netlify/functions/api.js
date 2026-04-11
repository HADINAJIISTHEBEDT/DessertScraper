const https = require("https");

const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;

// Simple HTML parser
function parseHtml(html) {
  const results = [];

  // Look for JSON-LD structured data (most e-commerce sites have this)
  const jsonLdMatches = html.match(
    /<script type="application\/ld\+json">([^<]+)<\/script>/g,
  );
  if (jsonLdMatches) {
    for (const match of jsonLdMatches) {
      try {
        const json = JSON.parse(match.replace(/<script[^>]*>|<\/script>/g, ""));
        if (
          json["@type"] === "Product" ||
          (Array.isArray(json) && json[0]?.["@type"] === "Product")
        ) {
          const products = Array.isArray(json) ? json : [json];
          for (const p of products) {
            const name = p.name || p.title;
            const price = extractPrice(p.offers?.price || p.price);
            const image = p.image || p.thumbnailUrl;
            if (name && price) {
              results.push({ name, price, image });
            }
          }
        }
      } catch (e) {}
    }
  }

  // Fallback: regex-based extraction for Turkish e-commerce sites
  if (results.length === 0) {
    // Sok pattern
    const sokPattern =
      /<a[^>]*href="[^"]*\/urun\/[^"]*"[^>]*>[\s\S]*?<h[2-6][^>]*>([^<]+)<\/h[2-6]>[\s\S]*?<span[^>]*>([^<]*\d+[.,]\d+[^<]*)<\/span>/gi;
    let match;
    while ((match = sokPattern.exec(html)) !== null) {
      const name = match[1].trim();
      const priceText = match[2].trim();
      const price = extractPrice(priceText);
      if (name && price && name.length > 2) {
        results.push({ name, price });
      }
    }

    // Carrefour pattern
    const carrefourPattern =
      /<div[^>]*class="[^"]*product[^"]*"[^>]*>[\s\S]*?<h[2-6][^>]*>([^<]+)<\/h[2-6]>[\s\S]*?<span[^>]*class="[^"]*price[^"]*"[^>]*>([^<]+)<\/span>/gi;
    while ((match = carrefourPattern.exec(html)) !== null) {
      const name = match[1].trim();
      const priceText = match[2].trim();
      const price = extractPrice(priceText);
      if (name && price && name.length > 2) {
        results.push({ name, price });
      }
    }

    // Generic pattern for any site
    const genericPattern =
      /<a[^>]*>[\s\S]*?<h[2-6][^>]*>([^<]{3,100})<\/h[2-6]>[\s\S]*?(₺\s*[\d.,]+|[\d.,]+\s*TL|[\d.,]+\s*₺)/gi;
    while ((match = genericPattern.exec(html)) !== null) {
      const name = match[1].trim();
      const priceText = match[2].trim();
      const price = extractPrice(priceText);
      if (name && price && !results.find((r) => r.name === name)) {
        results.push({ name, price });
      }
    }
  }

  return results.slice(0, 10);
}

function extractPrice(text) {
  if (!text) return null;
  const patterns = [
    /₺\s*([\d.,]+)/,
    /([\d.,]+)\s*TL/i,
    /([\d.,]+)\s*₺/,
    /(\d+[.,]\d{2})/,
  ];

  for (const pattern of patterns) {
    const m = String(text).match(pattern);
    if (m) {
      const numStr = m[1].replace(/\./g, "").replace(",", ".");
      const val = parseFloat(numStr);
      if (!isNaN(val) && val > 0.5 && val < 10000) return val;
    }
  }
  return null;
}

async function scrapeWithApi(url) {
  if (!SCRAPER_API_KEY) {
    console.error("SCRAPER_API_KEY not set");
    return null;
  }

  // Try without render first (faster, more reliable)
  const apiUrl = `https://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(url)}&country_code=tr`;

  return new Promise((resolve) => {
    const req = https.get(apiUrl, { timeout: 25000 }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    });
    req.on("error", (err) => {
      console.error("ScraperAPI error:", err.message);
      resolve(null);
    });
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
  });
}

async function scrapeSok(product) {
  const url = `https://www.sokmarket.com.tr/arama?q=${encodeURIComponent(product)}`;
  console.log(`[Sok] Searching for: ${product}`);

  const html = await scrapeWithApi(url);
  if (!html) {
    console.log("[Sok] Failed to fetch");
    return getMockData(product, "Sok");
  }

  const items = parseHtml(html).map((item) => ({
    market: "Sok",
    name: item.name.substring(0, 100),
    price: item.price,
    image: item.image || "",
  }));

  console.log(`[Sok] Found ${items.length} items`);

  // If no items found, return mock data for testing
  if (items.length === 0) {
    console.log("[Sok] No items found, using mock data");
    return getMockData(product, "Sok");
  }

  return items;
}

async function scrapeCarrefour(product) {
  const url = `https://www.carrefoursa.com/search/?q=${encodeURIComponent(product)}`;
  console.log(`[Carrefour] Searching for: ${product}`);

  const html = await scrapeWithApi(url);
  if (!html) {
    console.log("[Carrefour] Failed to fetch");
    return getMockData(product, "Carrefour");
  }

  const items = parseHtml(html).map((item) => ({
    market: "Carrefour",
    name: item.name.substring(0, 100),
    price: item.price,
    image: item.image || "",
  }));

  console.log(`[Carrefour] Found ${items.length} items`);

  if (items.length === 0) {
    console.log("[Carrefour] No items found, using mock data");
    return getMockData(product, "Carrefour");
  }

  return items.slice(0, 15);
}

function getMockData(product, market) {
  return [
    {
      market: market,
      name: `${product} - ${market} Ürün 1`,
      price: market === "Sok" ? 25.9 : 27.5,
      image: "",
    },
    {
      market: market,
      name: `${product} - ${market} Ürün 2`,
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
      scrapeSok(product),
      scrapeCarrefour(product),
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
  console.log("API Key present:", !!SCRAPER_API_KEY);

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
