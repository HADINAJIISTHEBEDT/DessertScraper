const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function parsePrice(txt) {
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
}

async function scrapeSok(product) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );

    console.log(`[Sok] Searching for: ${product}`);
    await page.goto(
      `https://www.sokmarket.com.tr/arama?q=${encodeURIComponent(product)}`,
      { waitUntil: "domcontentloaded", timeout: 60000 },
    );

    await delay(3000);
    await page.waitForSelector("body");
    await delay(2000);

    // Scroll to load products
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
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

      const items = [];
      const seen = new Set();

      // Get all product links and containers
      const allLinks = document.querySelectorAll(
        'a[href*="/urun/"], a[href*="/product/"]',
      );
      const productCards = document.querySelectorAll(
        '[class*="product"], [class*="Product"], .product-card, .product-item, article',
      );

      const elements = allLinks.length > 0 ? allLinks : productCards;

      elements.forEach((el) => {
        try {
          const text = (el.innerText || el.textContent || "").trim();
          if (!text || text.length < 5) return;

          const price = parsePrice(text);
          if (!price || price < 0.5) return;

          // Try to get product name
          let name = "";
          const nameSelectors = [
            "h2",
            "h3",
            "h4",
            ".name",
            ".title",
            '[class*="name"]',
            '[class*="title"]',
            "span",
          ];
          for (const sel of nameSelectors) {
            const nameEl = el.querySelector(sel);
            if (nameEl && nameEl.innerText && nameEl.innerText.length > 2) {
              name = nameEl.innerText.trim();
              break;
            }
          }

          // Fallback: get first meaningful line
          if (!name) {
            const lines = text
              .split("\n")
              .map((l) => l.trim())
              .filter((l) => l.length > 2);
            name =
              lines.find((l) => !l.match(/^\d/) && !l.match(/₺|TL/i)) ||
              lines[0] ||
              "";
          }

          // Get image
          let image = "";
          const imgEl = el.querySelector("img");
          if (imgEl) {
            image =
              imgEl.src ||
              imgEl.getAttribute("data-src") ||
              imgEl.getAttribute("data-lazy") ||
              "";
          }

          if (name && name.length > 2 && price > 0) {
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
    await browser.close();
    return [];
  }
}

async function scrapeCarrefour(product) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );

    console.log(`[Carrefour] Searching for: ${product}`);
    await page.goto(
      `https://www.carrefoursa.com/search/?q=${encodeURIComponent(product)}`,
      { waitUntil: "domcontentloaded", timeout: 60000 },
    );

    await delay(4000);
    await page.waitForSelector("body");
    await delay(2000);

    // Scroll to load products
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
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

      const items = [];
      const seen = new Set();

      // Carrefour specific selectors
      const selectors = [
        'a[href*="/p/"]',
        '[class*="product"]',
        "article",
        "[data-product-id]",
        ".item",
      ];

      let elements = [];
      for (const sel of selectors) {
        const found = document.querySelectorAll(sel);
        if (found.length > elements.length) {
          elements = found;
        }
      }

      elements.forEach((el) => {
        try {
          const text = (el.innerText || el.textContent || "").trim();
          if (!text || text.length < 5) return;

          const price = parsePrice(text);
          if (!price || price < 0.5 || price > 10000) return;

          // Get product name
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
            if (nameEl && nameEl.innerText && nameEl.innerText.length > 2) {
              const txt = nameEl.innerText.trim();
              if (!txt.match(/^\d/) && !txt.match(/₺|TL/i)) {
                name = txt;
                break;
              }
            }
          }

          // Fallback
          if (!name) {
            const lines = text
              .split("\n")
              .map((l) => l.trim())
              .filter((l) => l.length > 2);
            name =
              lines.find((l) => !l.match(/^\d/) && !l.match(/₺|TL/i)) ||
              lines[0] ||
              "";
          }

          // Get image
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

          if (name && name.length > 2 && price > 0) {
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
    await browser.close();
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
  const [sok, carrefour] = await Promise.all([
    scrapeSok(product).catch(() => []),
    scrapeCarrefour(product).catch(() => []),
  ]);
  return {
    sok: Array.isArray(sok) ? sok : [],
    carrefour: Array.isArray(carrefour) ? carrefour : [],
  };
}

module.exports = { compareIngredients, searchProduct, searchMultiple };
