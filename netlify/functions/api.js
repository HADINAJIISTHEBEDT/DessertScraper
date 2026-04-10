const chromium = require("@sparticuz/chromium");
const puppeteer = require("puppeteer-core");

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

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

async function getBrowser() {
  return await puppeteer.launch({
    args: [...chromium.args, "--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
  });
}

async function scrapeSok(product) {
  let browser;
  try {
    browser = await getBrowser();
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );

    console.log(`[Sok] Searching for: ${product}`);
    await page.goto(
      `https://www.sokmarket.com.tr/arama?q=${encodeURIComponent(product)}`,
      { waitUntil: "domcontentloaded", timeout: 30000 },
    );

    await delay(3000);
    await page.waitForSelector("body");
    await delay(2000);

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await delay(2000);

    const result = await page.evaluate(() => {
      const parsePrice = (txt) => {
        if (!txt) return null;
        const patterns = [
          /₺\s*([\d.,]+)/,
          /([\d.,]+)\s*TL/i,
          /([\d]+[.,][\d]{2})/,
          /(\d+)[.,](\d+)/,
        ];

        for (const pattern of patterns) {
          const m = txt.match(pattern);
          if (m) {
            const numStr = (m[1] || m[0]).replace(/\./g, "").replace(",", ".");
            const val = parseFloat(numStr);
            if (!isNaN(val) && val > 0) return val;
          }
        }
        return null;
      };

      const isValidName = (name) => {
        if (!name) return false;
        if (name.length < 3) return false;
        if (/^[\d.,]+$/.test(name)) return false;
        if (/^[\d.,]+[₺TL\s]*$/i.test(name)) return false;
        return true;
      };

      const items = [];
      const seen = new Set();
      const productLinks = document.querySelectorAll('a[href*="/urun/"]');

      productLinks.forEach((el) => {
        try {
          const text = (el.innerText || el.textContent || "").trim();
          if (!text || text.length < 5) return;

          const price = parsePrice(text);
          if (!price || price < 0.5) return;

          let name = "";
          const nameSelectors = [
            "h2",
            "h3",
            "h4",
            ".name",
            ".title",
            '[class*="name"]',
            "span",
          ];
          for (const sel of nameSelectors) {
            const nameEl = el.querySelector(sel);
            if (nameEl && nameEl.innerText) {
              const txt = nameEl.innerText.trim();
              if (isValidName(txt)) {
                name = txt;
                break;
              }
            }
          }

          if (!isValidName(name)) {
            const lines = text
              .split("\n")
              .map((l) => l.trim())
              .filter((l) => l.length > 2);
            name = lines.find((l) => isValidName(l)) || "";
          }

          let image = "";
          const imgEl = el.querySelector("img");
          if (imgEl) {
            image =
              imgEl.src ||
              imgEl.getAttribute("data-src") ||
              imgEl.getAttribute("data-lazy") ||
              "";
          }

          if (isValidName(name) && price > 0) {
            const key = name.toLowerCase().substring(0, 30);
            if (!seen.has(key)) {
              seen.add(key);
              items.push({
                market: "Sok",
                name: name.substring(0, 100),
                price,
                image,
              });
            }
          }
        } catch (e) {}
      });

      return items;
    });

    console.log(`[Sok] Results:`, result?.length || 0, "items");
    await browser.close();
    return result || [];
  } catch (err) {
    console.error(`[Sok] Error:`, err.message);
    if (browser) await browser.close();
    return [];
  }
}

async function scrapeCarrefour(product) {
  let browser;
  try {
    browser = await getBrowser();
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );

    console.log(`[Carrefour] Searching for: ${product}`);
    await page.goto(
      `https://www.carrefoursa.com/search/?q=${encodeURIComponent(product)}`,
      { waitUntil: "domcontentloaded", timeout: 30000 },
    );

    await delay(4000);
    await page.waitForSelector("body");
    await delay(2000);

    await page.evaluate(() =>
      window.scrollTo(0, document.body.scrollHeight / 2),
    );
    await delay(2000);

    const result = await page.evaluate(() => {
      const parsePrice = (txt) => {
        if (!txt) return null;
        const patterns = [
          /₺\s*([\d.,]+)/,
          /([\d.,]+)\s*TL/i,
          /([\d]+[.,][\d]{2})/,
          /(\d+)[.,](\d+)/,
        ];

        for (const pattern of patterns) {
          const m = txt.match(pattern);
          if (m) {
            const numStr = (m[1] || m[0]).replace(/\./g, "").replace(",", ".");
            const val = parseFloat(numStr);
            if (!isNaN(val) && val > 0) return val;
          }
        }
        return null;
      };

      const isValidName = (name) => {
        if (!name) return false;
        if (name.length < 3) return false;
        if (/^[\d.,]+$/.test(name)) return false;
        if (/^[\d.,]+[₺TL\s]*$/i.test(name)) return false;
        if (name.toLowerCase() === "adet") return false;
        if (name.toLowerCase() === "kategori") return false;
        return true;
      };

      const items = [];
      const seen = new Set();
      const productLinks = document.querySelectorAll('a[href*="/p/"]');

      productLinks.forEach((el) => {
        try {
          const text = (el.innerText || el.textContent || "").trim();
          if (!text || text.length < 5) return;

          const price = parsePrice(text);
          if (!price || price < 0.5 || price > 10000) return;

          let name = "";
          const nameSelectors = [
            '[class*="name"]',
            '[class*="title"]',
            "h2",
            "h3",
            "h4",
            "span",
          ];
          for (const sel of nameSelectors) {
            const nameEl = el.querySelector(sel);
            if (nameEl && nameEl.innerText) {
              const txt = nameEl.innerText.trim();
              if (isValidName(txt)) {
                name = txt;
                break;
              }
            }
          }

          if (!isValidName(name)) {
            const lines = text
              .split("\n")
              .map((l) => l.trim())
              .filter((l) => l.length > 2);
            name = lines.find((l) => isValidName(l)) || "";
          }

          let image = "";
          const imgEl = el.querySelector("img");
          if (imgEl) {
            image =
              imgEl.src ||
              imgEl.getAttribute("data-src") ||
              imgEl.getAttribute("data-lazy") ||
              "";
            if (image && image.startsWith("//")) image = "https:" + image;
          }

          if (isValidName(name) && price > 0) {
            const key = name.toLowerCase().substring(0, 30);
            if (!seen.has(key)) {
              seen.add(key);
              items.push({
                market: "Carrefour",
                name: name.substring(0, 100),
                price,
                image,
              });
            }
          }
        } catch (e) {}
      });

      return items.slice(0, 15);
    });

    console.log(`[Carrefour] Results:`, result?.length || 0, "items");
    await browser.close();
    return result || [];
  } catch (err) {
    console.error(`[Carrefour] Error:`, err.message);
    if (browser) await browser.close();
    return [];
  }
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

    const sokItem =
      Array.isArray(sokItems) && sokItems.length > 0 ? sokItems[0] : null;
    const carrefourItem =
      Array.isArray(carrefourItems) && carrefourItems.length > 0
        ? carrefourItems[0]
        : null;

    const sokUnit = sokItem ? Number(sokItem.price) : null;
    const carrefourUnit = carrefourItem ? Number(carrefourItem.price) : null;

    const sokCost =
      sokUnit !== null && Number.isFinite(sokUnit) ? sokUnit * quantity : null;
    const carrefourCost =
      carrefourUnit !== null && Number.isFinite(carrefourUnit)
        ? carrefourUnit * quantity
        : null;

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
      scrapeSok(product).catch(() => []),
      scrapeCarrefour(product).catch(() => []),
    ]);

    const sokResults = Array.isArray(sok) ? sok : [];
    const carrefourResults = Array.isArray(carrefour) ? carrefour : [];

    // If both empty, return mock data for testing
    if (sokResults.length === 0 && carrefourResults.length === 0) {
      console.log("[SearchAll] No results, returning mock data for testing");
      return {
        sok: [
          {
            market: "Sok",
            name: `${product} - Test Result 1`,
            price: 25.9,
            image: "",
          },
          {
            market: "Sok",
            name: `${product} - Test Result 2`,
            price: 32.5,
            image: "",
          },
        ],
        carrefour: [
          {
            market: "Carrefour",
            name: `${product} - Test Result 1`,
            price: 27.5,
            image: "",
          },
          {
            market: "Carrefour",
            name: `${product} - Test Result 2`,
            price: 30.0,
            image: "",
          },
        ],
        _note: "Mock data - real scraping may be blocked on serverless",
      };
    }

    return {
      sok: sokResults,
      carrefour: carrefourResults,
    };
  } catch (err) {
    console.error("[SearchAll] Error:", err);
    return {
      sok: [
        {
          market: "Sok",
          name: `${product} - Fallback`,
          price: 25.0,
          image: "",
        },
      ],
      carrefour: [
        {
          market: "Carrefour",
          name: `${product} - Fallback`,
          price: 28.0,
          image: "",
        },
      ],
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
