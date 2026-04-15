const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const BROWSER_OPTIONS = {
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
};

async function createPage(browser) {
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36"
  );
  await page.setViewport({ width: 1440, height: 2200 });
  await page.setExtraHTTPHeaders({
    "accept-language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
  });
  return page;
}

function parsePrice(txt) {
  if (!txt) return null;
  const patterns = [
    /₺\s*([\d.,]+)/,
    /([\d.,]+)\s*TL/i,
    /([\d]+[.,][\d]{2})/,
  ];

  for (const pattern of patterns) {
    const m = txt.match(pattern);
    if (m) {
      const numStr = m[1].replace(/\./g, "").replace(",", ".");
      const val = parseFloat(numStr);
      if (!isNaN(val) && val > 0) return val;
    }
  }
  return null;
}

async function scrapeSok(product) {
  const browser = await puppeteer.launch(BROWSER_OPTIONS);
  const page = await createPage(browser);

  try {
    console.log(`[Sok] Searching for: ${product}`);
    await page.goto(
      `https://www.sokmarket.com.tr/arama?q=${encodeURIComponent(product)}`,
      { waitUntil: "networkidle2", timeout: 60000 }
    );

    await delay(3000);
    await page.evaluate(() => window.scrollBy(0, 1000));
    await delay(1500);

    const result = await page.evaluate(() => {
      function normalizeName(value) {
        return String(value || "").replace(/\s+/g, " ").trim();
      }
      function readPrice(text) {
        const match = String(text || "").match(/₺\s*([\d.,]+)|([\d]+[.,]\d{2})/);
        if (!match) return null;
        const raw = match[1] || match[2];
        const parsed = parseFloat(raw.replace(/\./g, "").replace(",", "."));
        return Number.isFinite(parsed) ? parsed : null;
      }
      const items = [];
      const seen = new Set();
      const selectors = [
        "[data-testid*='product']",
        "article",
        "a[href*='/urun/']",
        "a[href*='/product/']",
        ".product-card",
        ".product-item",
        "[class*='product']",
      ];

      const candidates = [];
      selectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((el) => candidates.push(el));
      });

      candidates.forEach((el) => {
        const text = normalizeName(el.innerText);
        if (text.length < 4) return;
        const price = readPrice(text);
        if (!price || price < 0.1) return;

        let name = "";
        const nameSelectors = [
          "[class*='name']",
          "[class*='title']",
          "h1",
          "h2",
          "h3",
          "h4",
          "strong",
        ];
        for (const selector of nameSelectors) {
          const node = el.querySelector(selector);
          if (node?.innerText) {
            const value = normalizeName(node.innerText);
            if (value.length > 2 && !value.includes("₺")) {
              name = value;
              break;
            }
          }
        }
        if (!name) {
          name = normalizeName(text.split(/\n|₺|TL/i)[0]);
        }

        let image = "";
        const imgEl = el.querySelector("img");
        if (imgEl) {
          image =
            imgEl.currentSrc ||
            imgEl.src ||
            imgEl.getAttribute("data-src") ||
            imgEl.getAttribute("srcset") ||
            "";
        }

        if (name.length > 2) {
          const key = `${name.toLowerCase()}|${price}`;
          if (!seen.has(key)) {
            seen.add(key);
            items.push({ market: "Sok", name, price, image });
          }
        }
      });

      return items.slice(0, 20);
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
  const browser = await puppeteer.launch(BROWSER_OPTIONS);
  const page = await createPage(browser);

  try {
    console.log(`[Carrefour] Searching for: ${product}`);
    await page.goto(
      `https://www.carrefoursa.com/search/?q=${encodeURIComponent(product)}`,
      { waitUntil: "networkidle2", timeout: 60000 }
    );

    await delay(4000);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await delay(1500);

    const result = await page.evaluate(() => {
      function normalizeName(value) {
        return String(value || "").replace(/\s+/g, " ").trim();
      }
      function readPrice(text) {
        const match = String(text || "").match(/₺\s*([\d.,]+)|([\d]+[.,]\d{2})/);
        if (!match) return null;
        const raw = match[1] || match[2];
        const parsed = parseFloat(raw.replace(/\./g, "").replace(",", "."));
        return Number.isFinite(parsed) ? parsed : null;
      }
      const items = [];
      const seen = new Set();
      document
        .querySelectorAll(
          'a[href*="/p/"], a[href*="/urun/"], article, [class*="product-card"], [class*="product-item"], [class*="product"]'
        )
        .forEach((el) => {
          const text = normalizeName(el.innerText);
          if (text.length < 5) return;

          const price = readPrice(text);
          if (!price || price < 1) return;

          let name = "";
          const nameEl = el.querySelector("[class*='name'], [class*='title'], h1, h2, h3, h4, strong");
          if (nameEl) name = normalizeName(nameEl.innerText);
          if (!name || name.length < 3) {
            const lines = text.split("\n").map(normalizeName).filter((line) => line.length > 3 && !line.includes("₺"));
            name = lines[0] || "";
          }

          let image = "";
          const imgEl = el.querySelector("img");
          if (imgEl) {
            image =
              imgEl.currentSrc ||
              imgEl.src ||
              imgEl.getAttribute("data-src") ||
              imgEl.getAttribute("data-lazy") ||
              "";
          }

          if (name && name.length > 3) {
            const key = `${name.toLowerCase()}|${price}`;
            if (!seen.has(key)) {
              seen.add(key);
              items.push({ market: "Carrefour", name, price, image });
            }
          }
        });

      return items.slice(0, 20);
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
      scrapeSok(name).catch((err) => {
        console.error(`[Compare][Sok] ${name}:`, err.message);
        return [];
      }),
      scrapeCarrefour(name).catch((err) => {
        console.error(`[Compare][Carrefour] ${name}:`, err.message);
        return [];
      }),
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
      sokUnit !== null && Number.isFinite(sokUnit)
        ? sokUnit * quantity
        : null;
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
  if (market === "sok") return await scrapeSok(product).catch(() => []);
  if (market === "carrefour") return await scrapeCarrefour(product).catch(() => []);
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
